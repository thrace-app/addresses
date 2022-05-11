import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { Account, AccountType } from '../types/account'
import { TokenType } from '../types/token'

const GROUP = 'SushiSwap'
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const STEP = 1000
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
}

interface Query {
  pairs: Pair[]
}

const fetchSushiSwap = async (): Promise<Account[]> => {
  const accounts: Account[] = DEPLOYMENTS

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

    accounts.push(
      ...response.pairs.map(
        (pair) =>
          ({
            address: pair.id,
            displayName: `${GROUP}: ${pair.name}`,
            group: GROUP,
            type: AccountType.LiquidityProvider,
          } as Account)
      )
    )

    console.log(
      `Fetched ${GROUP}: ${response.pairs.length} (${accounts.length} total)`
    )
  } while (response.pairs.length > 0)

  return accounts
}

export default fetchSushiSwap
