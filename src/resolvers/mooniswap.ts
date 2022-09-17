import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { Account, AccountType } from '../types/account'
import { TokenType, type ERC20Token } from '../types/token'
import type { Resolver } from './resolver'

const GROUP = 'mooniswap'
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000
const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/mmontes11/mooniswap'
const LP_QUERY = gql`
  query LiquidityProviders($first: Int, $lastId: ID) {
    pairs(first: $first, where: { id_gt: $lastId }) {
      id
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

const DEPLOYMENTS: Account[] = []

interface Token {
  id: string
  symbol: string
  name: string
  decimals: string
}

interface Pair {
  id: string
  token0: Token
  token1: Token
}

interface Query {
  pairs: Pair[]
}

export class MooniswapResolver implements Resolver {
  getSupportedNetworks(): number[] {
    return [1]
  }

  async resolve() {
    const accounts: Account[] = DEPLOYMENTS
    const tokens: Record<string, Account> = {}

    let response: Query = {
      pairs: [],
    }

    do {
      const lastAddress =
        response.pairs[response.pairs.length - 1]?.id || NULL_ADDRESS

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

      for (const pair of response.pairs) {
        accounts.push({
          address: pair.id,
          displayName: `Mooniswap: ${pair.token0.name}-${pair.token1.name}`,
          group: 'Mooniswap',
          type: AccountType.LiquidityProvider,
        })

        tokens[pair.token0.id] = {
          address: pair.token0.id,
          displayName: pair.token0.name,
          type: AccountType.Token,
          token: {
            name: pair.token0.name,
            symbol: pair.token0.symbol,
            decimals: parseInt(pair.token0.decimals),
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
            decimals: parseInt(pair.token1.decimals),
            type: TokenType.Erc20,
          } as ERC20Token,
        }
      }

      const currentPoolsLength = accounts.length
      const currentTokensLength = Object.keys(tokens).length

      console.log(
        `Fetched ${GROUP}: ${response.pairs.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) After: ${lastAddress}`
      )
    } while (response.pairs.length > 0)

    return {
      [GROUP]: accounts,
      tokens: Object.values(tokens),
    }
  }
}
