export enum TokenType {
  Coin = 'COIN',
  Erc20 = 'ERC20',
  Erc721 = 'ERC721',
}

export interface Token {
  name: string
  symbol: string
  type: TokenType
}
