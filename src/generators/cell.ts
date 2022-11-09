import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { type Account, AccountType } from '../types/account'
import { TokenType, type ERC721Token } from '../types/token'
import type { Generator } from './generator'
import { Network } from '../types/network'
import { NULL_ADDRESS } from '../utils/constants'

const STEP = 1000

const NETWORKS: Record<number, string> = {
  [Network.Mainnet]: 'https://api.thegraph.com/subgraphs/name/leon0399/cell',
}

const LP_QUERY = gql`
  query Collections($first: Int, $lastId: ID) {
    collections(first: $first, where: { id_gt: $lastId }) {
      id
      name
      symbol
    }
  }
`

interface Collection {
  id: string
  name: string
  symbol: string
}

interface Query {
  collections: Collection[]
}

export class CellResolver implements Generator {
  getSupportedNetworks(): number[] {
    return Object.keys(NETWORKS).map((networkId) => parseInt(networkId))
  }

  async resolve(networkId: number) {
    // Guaranteed to be not null by `getSupportedNetworks`
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const queryUrl: string = NETWORKS[networkId]!

    const accounts: Account[] = []
    const tokens: Record<string, Account> = {}

    let response: Query = {
      collections: [],
    }

    do {
      const lastAddress =
        response.collections[response.collections.length - 1]?.id ||
        NULL_ADDRESS

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

      for (const collection of response.collections) {
        accounts.push({
          address: collection.id,
          displayName: collection.name,
          type: AccountType.Token,
          token: {
            name: collection.name,
            symbol: collection.symbol,
            type: TokenType.Erc721,
          } as ERC721Token,
        })
      }

      const currentPoolsLength = accounts.length
      const currentTokensLength = Object.keys(tokens).length

      console.log(
        `Fetched cell.computer (${networkId}): ${response.collections.length} (${currentPoolsLength} pools, ${currentTokensLength} tokens) After: ${lastAddress}`
      )
    } while (response.collections.length > 0)

    return {
      erc721: accounts,
    }
  }
}
