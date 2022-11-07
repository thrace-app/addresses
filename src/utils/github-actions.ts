export function startGroup(name: string): void {
  process.env.GITHUB_ACTIONS === 'true' && console.log(`::group::${name}`)
}

export function endGroup(): void {
  process.env.GITHUB_ACTIONS === 'true' && console.log('::endgroup::')
}
