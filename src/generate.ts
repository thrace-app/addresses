import fs from 'fs'
import path, { dirname } from 'path'

import * as Resolvers from './resolvers'
import { type Account } from './types/account'

const uniqie = <T>(value: T, index: number, self: T[]): boolean => {
  return self.indexOf(value) === index
}

const uniqueBy = <T extends Record<string, any>>(
  array: T[],
  by: keyof T
): T[] => {
  return [...new Map<string, T>(array.map((item) => [item[by], item])).values()]
}

const generateDatabases = async () => {
  const resolvers = Object.values(Resolvers).map((generator) => new generator())

  const networks = resolvers
    .flatMap((generator) => generator.getSupportedNetworks())
    .filter(uniqie)

  for (const netoworkId of networks) {
    const databases: Record<string, Account[]> = {}
    const currentResolvers = resolvers.filter((resolver) =>
      resolver.getSupportedNetworks().includes(netoworkId)
    )

    for (const resolver of currentResolvers) {
      const resolved = await resolver.resolve(netoworkId)

      for (const db in resolved) {
        databases[db] = uniqueBy(
          [...(databases[db] || []), ...resolved[db]],
          'address'
        )
      }
    }

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
        `../networks/${netoworkId}/${db}.json`
      )
      fs.mkdirSync(dirname(filename), { recursive: true })
      fs.writeFileSync(filename, json, 'utf-8')
    }
  }
}

generateDatabases()
