import { Account, AccountType } from '../types/account'
import { request, gql } from 'graphql-request'

const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/sushiswap/exchange'
const LP_QUERY = gql`
  query LiquidityProviders($first: Int, $skip: Int) {
    pairs(first: $first, skip: $skip) {
      id
      name
    }
  }
`

const STEP = 1000

interface Pair {
  id: string
  name: string
}

interface Query {
  pairs: Pair[]
}

const fetchSushiSwap = async (): Promise<Account[]> => {
  const accounts: Account[] = []

  let skip = 0

  let response: Query = {
    pairs: [],
  }

  do {
    response = await request<Query>(SUBGRAPH_URL, LP_QUERY, {
      first: STEP,
      skip,
    })

    skip += STEP

    accounts.push(
      ...response.pairs.map(
        (pair) =>
          ({
            address: pair.id,
            displayName: `Uniswap V3: ${pair.name}`,
            group: 'Uniswap V3',
            type: AccountType.LiquidityProvider,
          } as Account)
      )
    )
  } while (response.pairs.length > 0)

  return accounts
}

export default fetchSushiSwap
