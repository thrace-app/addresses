import { Network } from '../types/network'
import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { type Account, AccountType } from '../types/account'
import { TokenType, ERC20Token } from '../types/token'
import type { Generator } from './generator'
import { NULL_ADDRESS } from '../utils/constants'

const STEP = 1000

const NETWORKS: Record<number, string> = {
  [Network.Mainnet]:
    'https://api.thegraph.com/subgraphs/name/messari/curve-finance-ethereum',
  [Network.Avalanche]:
    'https://api.thegraph.com/subgraphs/name/messari/curve-finance-avalanche',
  [Network.Fantom]:
    'https://api.thegraph.com/subgraphs/name/messari/curve-finance-fantom',
  [Network.Optimism]:
    'https://api.thegraph.com/subgraphs/name/messari/curve-finance-optimism',
  [Network.ArbitrumOne]:
    'https://api.thegraph.com/subgraphs/name/messari/curve-finance-arbitrum',
  [Network.Polygon]:
    'https://api.thegraph.com/subgraphs/name/messari/curve-finance-polygon',
  [Network.Gnosis]:
    'https://api.thegraph.com/subgraphs/name/messari/curve-finance-gnosis',
}

const LP_QUERY = gql`
  query LiquidityPools($first: Int, $lastId: ID) {
    liquidityPools(first: $first, where: { id_gt: $lastId }) {
      id
      name
      symbol
      inputTokens {
        ...TokenInfo
      }
      outputToken {
        ...TokenInfo
      }
      rewardTokens {
        id
        type
        token {
          ...TokenInfo
        }
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

interface RewardToken {
  id: string
  token: Token
}

interface LiquidityPool {
  id: string
  symbol: string
  name: string
  inputTokens: Token[]
  outputToken: Token
  rewardTokens: RewardToken[]
}

interface Query {
  liquidityPools: LiquidityPool[]
}

export class CurveResolver implements Generator {
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
      liquidityPools: [],
    }

    do {
      const lastAddress =
        response.liquidityPools[response.liquidityPools.length - 1]?.id ||
        NULL_ADDRESS

      try {
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
      } catch (e) {
        console.error(e)
        break
      }

      for (const pool of response.liquidityPools) {
        accounts.push({
          address: pool.id,
          displayName: `${pool.name})`,
          group: 'Curve',
          type: AccountType.LiquidityProvider,
        })

        const allTokens = [
          ...pool.inputTokens,
          pool.outputToken,
          ...pool.rewardTokens.map((r) => r.token),
        ]

        for (const token of allTokens) {
          tokens[token.id] = {
            address: token.id,
            displayName: token.name,
            type: AccountType.Token,
            token: {
              name: token.name,
              symbol: token.symbol,
              decimals: parseInt(token.decimals),
              type: TokenType.Erc20,
            } as ERC20Token,
          }
        }
      }

      const currentPoolsLength = accounts.length
      const currentTokensLength = Object.keys(tokens).length

      console.log(
        `Fetched curve.fi (${networkId}): ${response.liquidityPools.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) After: ${lastAddress}`
      )
    } while (response.liquidityPools.length > 0)

    return {
      'curve-fi': accounts,
      erc20: Object.values(tokens),
    }
  }
}
