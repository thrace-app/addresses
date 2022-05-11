import { Account, AccountType } from '../types/account'
import { request, gql } from 'graphql-request'

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000
const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2'
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

interface Pair {
  id: string
  token0: Token
  token1: Token
}

interface Query {
  pairs: Pair[]
}

const fetchUniswapV2 = async (): Promise<Account[]> => {
  const accounts: Account[] = []

  const skip = 0

  let response: Query = {
    pairs: [],
  }

  do {
    const lastAddress =
      response.pairs[response.pairs.length - 1]?.id || NULL_ADDRESS

    response = await request<Query>(SUBGRAPH_URL, LP_QUERY, {
      first: STEP,
      lastId: lastAddress,
    })

    accounts.push(
      ...response.pairs.map(
        (pair) =>
          ({
            address: pair.id,
            displayName: `Uniswap V2: ${pair.token0.name}-${pair.token1.name}`,
            group: 'Uniswap V2',
            type: AccountType.LiquidityProvider,
          } as Account)
      )
    )

    console.log(
      `Fetched Uniswap V2: ${response.pairs.length} (${accounts.length} total) After: ${lastAddress}`
    )
  } while (response.pairs.length > 0)

  return accounts
}

export default fetchUniswapV2
