import { type Account } from './../types/account'

export type Resolver = () => Promise<Record<string, Account[]>>
