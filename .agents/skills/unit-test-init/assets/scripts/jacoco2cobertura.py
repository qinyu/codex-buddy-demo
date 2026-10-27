#!/usr/bin/env python3
# @version     1.0.0
# @description Convert Kover/JaCoCo XML to Cobertura XML (zero-dependency, Python stdlib only)
# @copies      Identical copies may exist in multiple skills. When updating, sync every copy:
#                addons/unit-test-init/assets/scripts/jacoco2cobertura.py
#                addons/unit-test-generator/assets/scripts/jacoco2cobertura.py
"""
kover2cobertura.py - Convert Kover/JaCoCo XML to Cobertura XML
Correctly reads line coverage from <sourcefile> elements.

Usage: python3 kover2cobertura.py <input.xml> <source_root> [<output.xml>]
       If output is omitted, writes to stdout.
"""

import sys
import time
import xml.etree.ElementTree as ET


def fraction(covered, missed):
    total = covered + missed
    return covered / total if total > 0 else 0.0


def counter_rate(element, ctype):
    for c in element.findall("counter"):
        if c.attrib.get("type") == ctype:
            covered = float(c.attrib.get("covered", 0))
            missed = float(c.attrib.get("missed", 0))
            return fraction(covered, missed)
    return 0.0


def convert(input_file, source_root):
    tree = ET.parse(input_file)
    root = tree.getroot()

    coverage = ET.Element("coverage")

    # timestamp
    si = root.find("sessioninfo")
    coverage.set(
        "timestamp",
        str(int(si.attrib["start"]) / 1000)
        if si is not None
        else str(int(time.time())),
    )

    # top-level rates
    coverage.set("line-rate", str(counter_rate(root, "LINE")))
    coverage.set("branch-rate", str(counter_rate(root, "BRANCH")))
    coverage.set("complexity", "0.0")
    coverage.set("version", "1")

    sources = ET.SubElement(coverage, "sources")
    # Use '.' so diff-cover resolves filenames relative to repo root
    ET.SubElement(sources, "source").text = "."

    packages_el = ET.SubElement(coverage, "packages")

    for pkg in root.findall("package"):
        pkg_name = pkg.attrib["name"].replace("/", ".")

        pkg_el = ET.SubElement(packages_el, "package")
        pkg_el.set("name", pkg_name)
        pkg_el.set("line-rate", str(counter_rate(pkg, "LINE")))
        pkg_el.set("branch-rate", str(counter_rate(pkg, "BRANCH")))
        pkg_el.set("complexity", "0.0")

        classes_el = ET.SubElement(pkg_el, "classes")

        for cls in pkg.findall("class"):
            cls_name = cls.attrib["name"].replace("/", ".")
            sourcefilename = cls.attrib.get(
                "sourcefilename", cls_name.split(".")[-1] + ".kt"
            )
            pkg_path = "/".join(cls.attrib["name"].split("/")[:-1])
            rel_path = (pkg_path + "/" + sourcefilename) if pkg_path else sourcefilename
            # Prepend source_root so path matches git diff (e.g. src/main/kotlin/com/example/...)
            filename = (
                (source_root.rstrip("/") + "/" + rel_path)
                if source_root and source_root != "."
                else rel_path
            )

            cls_el = ET.SubElement(classes_el, "class")
            cls_el.set("name", cls_name)
            cls_el.set("filename", filename)
            cls_el.set("line-rate", str(counter_rate(cls, "LINE")))
            cls_el.set("branch-rate", str(counter_rate(cls, "BRANCH")))
            cls_el.set("complexity", "0.0")

            # methods (rate only, no line detail needed)
            methods_el = ET.SubElement(cls_el, "methods")
            for method in cls.findall("method"):
                m_el = ET.SubElement(methods_el, "method")
                m_el.set("name", method.attrib.get("name", ""))
                m_el.set("signature", method.attrib.get("desc", ""))
                m_el.set("line-rate", str(counter_rate(method, "LINE")))
                m_el.set("branch-rate", str(counter_rate(method, "BRANCH")))
                ET.SubElement(m_el, "lines")

            # lines: read from <sourcefile> in the same package (accurate line numbers)
            lines_el = ET.SubElement(cls_el, "lines")
            sf = pkg.find('sourcefile[@name="' + sourcefilename + '"]')
            if sf is not None:
                for line in sf.findall("line"):
                    ci = int(line.attrib.get("ci", 0))
                    mi = int(line.attrib.get("mi", 0))
                    cb = int(line.attrib.get("cb", 0))
                    mb = int(line.attrib.get("mb", 0))

                    l_el = ET.SubElement(lines_el, "line")
                    l_el.set("number", line.attrib["nr"])
                    l_el.set("hits", "1" if ci > 0 else "0")

                    if cb + mb > 0:
                        pct = int(100 * fraction(cb, mb))
                        l_el.set("branch", "true")
                        l_el.set("condition-coverage", f"{pct}% ({cb}/{cb + mb})")
                        conds = ET.SubElement(
                            ET.SubElement(l_el, "conditions"), "condition"
                        )
                        conds.set("number", "0")
                        conds.set("type", "jump")
                        conds.set("coverage", f"{pct}%")
                    else:
                        l_el.set("branch", "false")

    return coverage


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: kover2cobertura.py <input.xml> <source_root> [<output.xml>]")
        sys.exit(1)

    input_file = sys.argv[1]
    source_root = sys.argv[2]
    output_file = sys.argv[3] if len(sys.argv) > 3 else None

    root = convert(input_file, source_root)
    out = '<?xml version="1.0" ?>\n' + ET.tostring(root, encoding="unicode")

    if output_file:
        with open(output_file, "w") as f:
            f.write(out)
        print(f"Cobertura XML written to {output_file}", file=sys.stderr)
    else:
        print(out)
