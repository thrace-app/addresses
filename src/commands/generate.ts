import fs from 'fs'
import { Command } from 'commander'
import path, { dirname } from 'path'

import logger from '../logger'

import * as Generators from '../generators'
import { type Generator } from '../generators'
import { type Account } from '../types/account'
import { endGroup, startGroup } from '../utils/github-actions'

const uniqueBy = <T extends Record<string, any>>(
  array: T[],
  by: keyof T
): T[] => {
  return [...new Map<string, T>(array.map((item) => [item[by], item])).values()]
}

interface GenerateCommandActionArgs {
  network: number[]
  generator: string[]
}

const generateCommandAction = async (args: GenerateCommandActionArgs) => {
  const generators: Generator[] = Object.entries(Generators) //
    .filter(
      ([generator]) =>
        !args.generator ||
        args.generator.length === 0 ||
        args.generator.includes(generator)
    )
    .map(([_, generator]) => new generator())

  const networks = [
    ...new Set(
      args.network ||
        generators.flatMap((generator) => generator.getSupportedNetworks())
    ),
  ]

  const networkCounts: Record<number, number> = {}

  for (const netoworkId of networks) {
    const databases: Record<string, Account[]> = {}
    const currentResolvers = generators.filter((generator) =>
      generator.getSupportedNetworks().includes(netoworkId)
    )

    for (const resolver of currentResolvers) {
      if (process.env.GITHUB_ACTIONS === 'true') {
        startGroup(`${resolver.constructor.name} for network '${netoworkId}'`)
      }

      const resolved = await resolver.resolve(netoworkId, { log: logger })

      for (const db in resolved) {
        databases[db] = uniqueBy(
          [...(databases[db] || []), ...resolved[db]],
          'address'
        )
      }
      if (process.env.GITHUB_ACTIONS === 'true') {
        endGroup()
      }
    }

    networkCounts[netoworkId] = Object.values(databases)
      .map((db) => db.length)
      .reduce((sum, len) => sum + len, 0)

    for (const db in databases) {
      const json = JSON.stringify(
        {
          $schema: '../../schema/database.schema.json',
          addresses: databases[db].sort((a, b) =>
            a.address.localeCompare(b.address)
          ),
        },
        null,
        2
      )

      const filename = path.join(
        __dirname,
        `../../networks/${netoworkId}/${db}.json`
      )
      fs.mkdirSync(dirname(filename), { recursive: true })
      fs.writeFileSync(filename, json, 'utf-8')
    }
  }

  for (const netoworkId in networkCounts) {
    console.log(`Subtotal: ${networkCounts[netoworkId]} for ${netoworkId}`)
  }

  const total = Object.values(networkCounts).reduce((sum, len) => sum + len, 0)
  console.log(`Total: ${total}`)
}

const generateCommand = new Command('generate')
  .option<number[]>(
    '-N, --network [networkIds...]',
    'specify networks',
    (value, prev: number[] = []) => [...prev, parseInt(value)]
  )
  .option('--generator [generators...]', 'specify generators')
  .action(generateCommandAction)

export default generateCommand
