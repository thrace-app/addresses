import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { type Account, AccountType } from '../types/account'
import { TokenType, type ERC20Token } from '../types/token'
import type { Resolver } from './resolver'

const GROUP = 'sushiswap'
const STEP = 1000
const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/sushiswap/exchange'
const LP_QUERY = gql`
  query LiquidityProviders($first: Int, $skip: Int) {
    pairs(first: $first, skip: $skip) {
      id
      name
      token0 {
        ...TokenInfo
      }
      token1 {
        ...TokenInfo
      }
    }
  }

  fragment TokenInfo on Token {
    id
    name
    symbol
    decimals
  }
`

const DEPLOYMENTS: Account[] = [
  {
    address: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    displayName: `${GROUP}: Router `,
    group: GROUP,
    type: AccountType.LiquidityProvider,
  },
]

interface Pair {
  id: string
  name: string

  token0: Token
  token1: Token
}

interface Token {
  id: string
  name: string
  symbol: string
  decimals: number
}

interface Query {
  pairs: Pair[]
}

export class SushiSwapResolver implements Resolver {
  getSupportedNetworks(): number[] {
    return [1]
  }

  async resolve() {
    const accounts: Account[] = DEPLOYMENTS
    const tokens: Record<string, Account> = {}

    let skip = 0

    let response: Query = {
      pairs: [],
    }

    do {
      response = await retry(
        async () =>
          await request<Query>(SUBGRAPH_URL, LP_QUERY, {
            first: STEP,
            skip,
          }),
        {
          retries: 5,
        }
      )

      skip += STEP

      for (const pair of response.pairs) {
        accounts.push({
          address: pair.id,
          displayName: `SushiSwap: ${pair.name}`,
          group: 'SushiSwap',
          type: AccountType.LiquidityProvider,
        })

        tokens[pair.token0.id] = {
          address: pair.token0.id,
          displayName: pair.token0.name,
          type: AccountType.Token,
          token: {
            name: pair.token0.name,
            symbol: pair.token0.symbol,
            decimals: pair.token0.decimals,
            type: TokenType.Erc20,
          } as ERC20Token,
        }

        tokens[pair.token1.id] = {
          address: pair.token1.id,
          displayName: pair.token1.name,
          type: AccountType.Token,
          token: {
            name: pair.token1.name,
            symbol: pair.token1.symbol,
            decimals: pair.token1.decimals,
            type: TokenType.Erc20,
          } as ERC20Token,
        }
      }

      const currentPoolsLength = accounts.length
      const currentTokensLength = Object.keys(tokens).length

      console.log(
        `Fetched ${GROUP}: ${response.pairs.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) Offset: ${skip}`
      )
    } while (response.pairs.length > 0)

    return {
      [GROUP]: accounts,
      tokens: Object.values(tokens),
    }
  }
}
