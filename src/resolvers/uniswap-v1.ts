import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { Account, AccountType } from '../types/account'
import { TokenType, type ERC20Token } from '../types/token'
import type { Resolver } from './resolver'

const GROUP = 'uniswap-v1'
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000
const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/graphprotocol/uniswap'
const LP_QUERY = gql`
  query LiquidityProviders($first: Int, $lastId: ID) {
    exchanges(first: $first, where: { id_gt: $lastId }) {
      id

      tokenAddress
      tokenSymbol
      tokenName
      tokenDecimals
    }
  }
`

const DEPLOYMENTS: Account[] = []

interface Exchange {
  id: string

  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  tokenDecimals: number
}

interface Query {
  exchanges: Exchange[]
}

export class UniswapV1Resolver implements Resolver {
  getSupportedNetworks(): number[] {
    return [1]
  }

  async resolve() {
    const accounts: Account[] = DEPLOYMENTS
    const tokens: Record<string, Account> = {}

    let response: Query = {
      exchanges: [],
    }

    do {
      const lastAddress =
        response.exchanges[response.exchanges.length - 1]?.id || NULL_ADDRESS

      response = await retry(
        async () =>
          await request<Query>(SUBGRAPH_URL, LP_QUERY, {
            first: STEP,
            lastId: lastAddress,
          }),
        {
          retries: 10,
        }
      )

      for (const exhcange of response.exchanges) {
        accounts.push({
          address: exhcange.id,
          displayName: `Uniswap V1: ${exhcange.tokenName}`,
          group: 'Uniswap V1',
          type: AccountType.LiquidityProvider,
        })

        tokens[exhcange.tokenAddress] = {
          address: exhcange.tokenAddress,
          displayName: exhcange.tokenName,
          type: AccountType.Token,
          token: {
            name: exhcange.tokenName,
            symbol: exhcange.tokenSymbol,
            decimals: exhcange.tokenDecimals,
            type: TokenType.Erc20,
          } as ERC20Token,
        }
      }

      const currentPoolsLength = accounts.length
      const currentTokensLength = Object.keys(tokens).length

      console.log(
        `Fetched ${GROUP}: ${response.exchanges.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) After: ${lastAddress}`
      )
    } while (response.exchanges.length > 0)

    return {
      [GROUP]: accounts,
      tokens: Object.values(tokens),
    }
  }
}
