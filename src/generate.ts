import fs from 'fs'
import path from 'path'

import Resolvers from './resolvers'

const generateDatabases = () => {
  const generators = Object.entries(Resolvers).map(
    async ([name, generator]) => {
      const resolved = await generator()
      const json = JSON.stringify(
        {
          $schema: '../../schema/database.schema.json',
          addresses: resolved,
        },
        null,
        2
      )

      const filename = path.join(__dirname, `../networks/1/${name}.json`)
      fs.writeFileSync(filename, json, 'utf8')
    }
  )
}

generateDatabases()
