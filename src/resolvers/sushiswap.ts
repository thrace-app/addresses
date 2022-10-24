import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { type Account, AccountType } from '../types/account'
import { TokenType, type ERC20Token } from '../types/token'
import type { Resolver } from './resolver'
import { Network } from '../types/network'

const GROUP = 'sushiswap'
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000

const NETWORKS: Record<number, string> = {
  [Network.Mainnet]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
  [Network.BSC]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/bsc-exchange',
  [Network.Polygon]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/matic-exchange',
  [Network.Fantom]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/fantom-exchange',
  [Network.ArbitrumOne]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/arbitrum-exchange',
  [Network.Celo]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/celo-exchange',
  [Network.Avalanche]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/avalanche-exchange',
  [Network.Moonriver]:
    'https://api.thegraph.com/subgraphs/name/sushiswap/moonriver-exchange',
}

const LP_QUERY = gql`
  query LiquidityProviders($first: Int, $lastId: ID) {
    pairs(first: $first, where: { id_gt: $lastId }) {
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
  decimals: string
}

interface Query {
  pairs: Pair[]
}

export class SushiSwapResolver implements Resolver {
  getSupportedNetworks(): number[] {
    return Object.keys(NETWORKS).map((networkId) => parseInt(networkId))
  }

  async resolve(networkId: number) {
    // Guaranteed to be not null by `getSupportedNetworks`
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const queryUrl: string = NETWORKS[networkId]!

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
          await request<Query>(queryUrl, LP_QUERY, {
            first: STEP,
            lastId: lastAddress,
          }),
        {
          retries: 5,
        }
      )

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
            decimals: parseInt(pair.token0.decimals),
            type: TokenType.Erc20,
          } as ERC20Token,
        }
      }

      const currentPoolsLength = accounts.length
      const currentTokensLength = Object.keys(tokens).length

      console.log(
        `Fetched ${GROUP} (${networkId}): ${response.pairs.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) After: ${lastAddress}`
      )
    } while (response.pairs.length > 0)

    return {
      [GROUP]: accounts,
      tokens: Object.values(tokens),
    }
  }
}
