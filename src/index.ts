import { program } from 'commander'

import { generateCommand } from './commands'

program.name('static-addresses').addCommand(generateCommand)

program.parse()
