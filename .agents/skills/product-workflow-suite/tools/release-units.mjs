const CHOICES = new Set(['core', 'portal', 'combined']);

export function planReleaseUnits({ version, selected }) {
  if (!CHOICES.has(selected)) throw new Error('未知发布单元');
  const unit = () => ({ version, hash: 'local', implicit: false });
  return {
    core: unit(),
    portal: unit(),
    publish: selected === 'combined' ? ['core', 'portal'] : [selected],
    readback: selected === 'combined',
  };
}
