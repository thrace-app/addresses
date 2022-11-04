import { Network } from './../types/network'
import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { type Account, AccountType } from '../types/account'
import { TokenType, ERC20Token } from '../types/token'
import type { Generator } from './generator'

const GROUP = 'kyberswap-elastic'
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000

const NETWORKS: Record<number, string> = {
  [Network.Mainnet]:
    'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-mainnet',
  [Network.Optimism]:
    'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-optimism',
  [Network.BSC]:
    'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-bsc',
  [Network.Polygon]:
    'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-matic',
  [Network.Fantom]:
    'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-fantom',
  [Network.ArbitrumOne]:
    'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-arbitrum-one',
  [Network.Avalanche]:
    'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-avalanche',
}

const LP_QUERY = gql`
  query LiquidityProviders($first: Int, $lastId: ID) {
    pools(first: $first, where: { id_gt: $lastId }) {
      id
      feeTier
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

interface Pool {
  id: string
  feeTier: string
  token0: Token
  token1: Token
}

interface Query {
  pools: Pool[]
}

export class KyberswapElasticResolver implements Generator {
  getSupportedNetworks() {
    return Object.keys(NETWORKS).map((networkId) => parseInt(networkId))
  }

  async resolve(networkId: number): Promise<Record<string, Account[]>> {
    // Guaranteed to be not null by `getSupportedNetworks`
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const queryUrl: string = NETWORKS[networkId]!

    const accounts: Account[] = DEPLOYMENTS
    const tokens: Record<string, Account> = {}

    let response: Query = {
      pools: [],
    }

    do {
      const lastAddress =
        response.pools[response.pools.length - 1]?.id || NULL_ADDRESS

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

      for (const pool of response.pools) {
        accounts.push({
          address: pool.id,
          displayName: `Kyberswap Elastic: ${pool.token0.name}-${pool.token1.name} (${pool.feeTier})`,
          group: 'Kyberswap Elastic',
          type: AccountType.LiquidityProvider,
        })

        tokens[pool.token0.id] = {
          address: pool.token0.id,
          displayName: pool.token0.name,
          type: AccountType.Token,
          token: {
            name: pool.token0.name,
            symbol: pool.token0.symbol,
            decimals: parseInt(pool.token0.decimals),
            type: TokenType.Erc20,
          } as ERC20Token,
        }

        tokens[pool.token1.id] = {
          address: pool.token1.id,
          displayName: pool.token1.name,
          type: AccountType.Token,
          token: {
            name: pool.token1.name,
            symbol: pool.token1.symbol,
            decimals: parseInt(pool.token1.decimals),
            type: TokenType.Erc20,
          } as ERC20Token,
        }
      }

      const currentPoolsLength = accounts.length
      const currentTokensLength = Object.keys(tokens).length

      console.log(
        `Fetched ${GROUP} (${networkId}): ${response.pools.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) After: ${lastAddress}`
      )
    } while (response.pools.length > 0)

    return {
      [GROUP]: accounts,
      tokens: Object.values(tokens),
    }
  }
}
