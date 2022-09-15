import { request, gql } from 'graphql-request'
import retry from 'async-retry'

import { type Account, AccountType } from '../types/account'
import { TokenType, ERC20Token } from '../types/token'
import type { Resolver } from './resolver'

const GROUP = 'uniswap-v3'
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
    id
    name
    symbol
    decimals
  }
`

const DEPLOYMENTS: Account[] = [
  {
    address: '0x6c9fc64a53c1b71fb3f9af64d1ae3a4931a5f4e9',
    displayName: `${GROUP}: Deployer`,
    group: GROUP,
    type: AccountType.Wallet,
  },

  {
    address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    displayName: `${GROUP}: Factory`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    displayName: `${GROUP}: Multicall 2`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2',
    displayName: `${GROUP}: Proxy Admin`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0xbfd8137f7d1516D3ea5cA83523914859ec47F573',
    displayName: `${GROUP}: Tick Lens`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    displayName: `${GROUP}: Quoter`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0x42B24A95702b9986e82d421cC3568932790A48Ec',
    displayName: `${GROUP}: NFT Descriptor`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0x91ae842A5Ffd8d12023116943e72A606179294f3',
    displayName: `${GROUP}: LP Descriptor NFT`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0xEe6A57eC80ea46401049E92587E52f5Ec1c24785',
    displayName: `${GROUP}: Transparent Upgradeable Proxy`,
    group: GROUP,
    type: AccountType.Other,
  },
  {
    address: '0xA5644E29708357803b5A882D272c41cC0dF92B34',
    displayName: `${GROUP}: Migrator`,
    group: GROUP,
    type: AccountType.Other,
  },

  {
    address: '0xe34139463bA50bD61336E0c446Bd8C0867c6fE65',
    displayName: `${GROUP}: Staker`,
    group: GROUP,
    type: AccountType.Other,
  },

  {
    address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    displayName: `${GROUP}: Router`,
    group: GROUP,
    type: AccountType.LiquidityProvider,
  },
  {
    address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    displayName: `${GROUP}: Router 2`,
    group: GROUP,
    type: AccountType.LiquidityProvider,
  },

  {
    address: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    displayName: `${GROUP}: Positions NFT`,
    group: GROUP,
    type: AccountType.Token,
    token: {
      name: 'Uniswap V3 Positions',
      symbol: 'UNI-V3-POS',
      type: TokenType.Erc721,
    },
  },
]

interface Token {
  id: string
  symbol: string
  name: string
  decimals: number
}

interface Pool {
  id: string
  token0: Token
  token1: Token
}

interface Query {
  pools: Pool[]
}

export class UniswapV3Resolver implements Resolver {
  getSupportedNetworks(): number[] {
    return [1]
  }

  async resolve() {
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
          displayName: `Uniswap V3: ${pool.token0.name}-${pool.token1.name}`,
          group: 'Uniswap V3',
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
}
