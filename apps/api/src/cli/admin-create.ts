import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import argon2 from 'argon2';
import { AdminUserEntity } from '../database/entities/index.js';
import { flagValue, withCli } from './_bootstrap.js';

const MIN_PASSWORD_LENGTH = 12;

/**
 * pnpm admin:create -- --email someone@example.org --role PUBLISHER|EDITOR
 * The password is read from stdin (hidden prompt on a TTY, one line when piped).
 * There is no default password and no public registration path.
 */
await withCli('admin-create', async ({ dataSource, args }) => {
  const emailRaw = flagValue(args, '--email');
  const role = flagValue(args, '--role') ?? 'PUBLISHER';
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    console.error('[admin-create] usage: pnpm admin:create -- --email <email> [--role PUBLISHER|EDITOR]');
    return 2;
  }
  if (role !== 'PUBLISHER' && role !== 'EDITOR') {
    console.error('[admin-create] --role must be PUBLISHER or EDITOR');
    return 2;
  }
  const email = emailRaw.trim().toLowerCase();
  const password = await readSecret('Password (min 12 characters, not echoed): ');
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`[admin-create] password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    return 1;
  }
  const repo = dataSource.getRepository(AdminUserEntity);
  if (await repo.existsBy({ email })) {
    console.error('[admin-create] an admin with that email already exists');
    return 1;
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const now = new Date();
  await repo.insert({ id: randomUUID(), email, passwordHash, role, disabled: false, authVersion: 1, createdAt: now, updatedAt: now, editVersion: 1 });
  console.log(`[admin-create] created ${role} ${email}`);
  return 0;
});

async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) return line.trimEnd();
    return '';
  }
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(prompt);
  muted = true;
  const answer = await rl.question('');
  muted = false;
  rl.close();
  process.stdout.write('\n');
  return answer;
}
