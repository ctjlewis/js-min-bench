import commander from 'commander';
import { run } from '../src/commands/run';
import { serve } from '../src/commands/serve';
import { render } from '../src/commands/render';
import { measure } from '../src/commands/measure';

commander.command('run [...args]').description('Run tests.').action(run);

commander
  .command('serve [compiler] [framework]')
  .description('Serve the given framework/compiler combo.')
  .action(() => { serve() });

commander
  .command('render')
  .description('Render results.json to HTML. Output in out/.')
  .action(() => { render() });

commander
  .command('measure')
  .description('Take a Lighthouse measurement.')
  .action(() => { measure() });

commander
  .option(
    '--toolFilter [regex]',
    'regex to match tools to run',
    (arg: string) => new RegExp(arg)
  )
  .option(
    '--inputFilter [regex]',
    'regex to match inputs to run',
    (arg: string) => new RegExp(arg)
  )
  .option('--skip-tests', 'skip running tests');

commander.parse(process.argv);
export { commander };
