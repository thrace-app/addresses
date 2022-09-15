import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { type Account, AccountType } from '../types/account'
import { TokenType, ERC20Token } from '../types/token'
import { type Resolver } from './resolver'

const GROUP = 'kyberswap-elastic'
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000
const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/kybernetwork/kyberswap-elastic-mainnet'
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
  decimals: number
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

const kyberswapElastic: Resolver = async () => {
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
        await request<Query>(SUBGRAPH_URL, LP_QUERY, {
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
          decimals: pool.token0.decimals,
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
          decimals: pool.token1.decimals,
          type: TokenType.Erc20,
        } as ERC20Token,
      }
    }

    const currentPoolsLength = accounts.length
    const currentTokensLength = Object.keys(tokens).length

    console.log(
      `Fetched ${GROUP}: ${response.pools.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) After: ${lastAddress}`
    )
  } while (response.pools.length > 0)

  return {
    [GROUP]: accounts,
    tokens: Object.values(tokens),
  }
}

export default kyberswapElastic
