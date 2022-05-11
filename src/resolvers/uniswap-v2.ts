import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { Account, AccountType } from '../types/account'

const GROUP = 'Uniswap V2'
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

const DEPLOYMENTS: Account[] = [
  {
    address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    displayName: `${GROUP}: Factory`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a',
    displayName: `${GROUP}: Router`,
    group: GROUP,
    type: AccountType.LiquidityProvider,
  },
  {
    address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    displayName: `${GROUP}: Router 2`,
    group: GROUP,
    type: AccountType.LiquidityProvider,
  },
]

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
  const accounts: Account[] = DEPLOYMENTS

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

    accounts.push(
      ...response.pairs.map(
        (pair) =>
          ({
            address: pair.id,
            displayName: `${GROUP}: ${pair.token0.name}-${pair.token1.name}`,
            group: GROUP,
            type: AccountType.LiquidityProvider,
          } as Account)
      )
    )

    console.log(
      `Fetched ${GROUP}: ${response.pairs.length} (${accounts.length} total) After: ${lastAddress}`
    )
  } while (response.pairs.length > 0)

  return accounts
}

export default fetchUniswapV2
