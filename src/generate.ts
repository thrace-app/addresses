import fs from 'fs'
import path from 'path'

import Resolvers from './resolvers'
import { type Account } from './types/account'

const uniqueBy = <T extends Record<string, any>>(
  array: T[],
  by: keyof T
): T[] => {
  return [...new Map<string, T>(array.map((item) => [item[by], item])).values()]
}

const generateDatabases = async () => {
  const generators = Object.entries(Resolvers)

  const databases: Record<string, Account[]> = {}

  for (const [_, generator] of generators) {
    const resolved = await generator()

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

    const filename = path.join(__dirname, `../networks/1/${db}.json`)
    fs.writeFileSync(filename, json, 'utf8')
  }
}

generateDatabases()
