import { Token } from './token'

export enum AccountType {
  Bridge = 'BRIDGE',
  Exchange = 'EXCHANGE',
  LiquidityProvider = 'LIQUIDITY_PROVIDER',
  Marketplace = 'MARKETPLACE',
  Mixer = 'MIXER',
  Other = 'OTHER',
  Token = 'TOKEN',
  Wallet = 'WALLET',
}

export interface Account {
  address: string
  displayName: string
  group?: string
  type: AccountType

  token?: Token
}
