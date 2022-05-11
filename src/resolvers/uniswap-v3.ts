import { Account, AccountType } from '../types/account'
import { request, gql } from 'graphql-request'

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000
const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3'
const LP_QUERY = gql`
  query LiquidityProviders($first: Int, $lastId: ID) {
    pools(first: $first, where: { id_gt: $lastId }) {
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
    symbol
    name
    symbol
  }
`

interface Token {
  id: string
  symbol: string
  name: string
}

interface Pool {
  id: string
  token0: Token
  token1: Token
}

interface Query {
  pools: Pool[]
}

const fetchUniswapV2 = async (): Promise<Account[]> => {
  const accounts: Account[] = []

  let response: Query = {
    pools: [],
  }

  do {
    const lastAddress =
      response.pools[response.pools.length - 1]?.id || NULL_ADDRESS

    response = await request<Query>(SUBGRAPH_URL, LP_QUERY, {
      first: STEP,
      lastId: lastAddress,
    })

    accounts.push(
      ...response.pools.map(
        (pool) =>
          ({
            address: pool.id,
            displayName: `Uniswap V2: ${pool.token0.name}-${pool.token1.name}`,
            group: 'Uniswap V2',
            type: AccountType.LiquidityProvider,
          } as Account)
      )
    )

    console.log(
      `Fetched Uniswap V3: ${response.pools.length} (${accounts.length} total) After: ${lastAddress}`
    )
  } while (response.pools.length > 0)

  return accounts
}

export default fetchUniswapV2
