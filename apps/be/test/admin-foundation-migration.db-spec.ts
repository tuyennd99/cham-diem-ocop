import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

const migrationDir = resolve(__dirname, '../prisma/migrations');

it('upgrades legacy rows without inventing historical data or changing identities', async () => {
  const explicit = Object.prototype.hasOwnProperty.call(
    process.env,
    'TEST_DATABASE_URL',
  );
  const url = new URL(
    (explicit ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL) ?? '',
  );
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    (explicit && !url.pathname.endsWith('_test')) ||
    url.searchParams.has('host') ||
    url.searchParams.has('hostaddr')
  )
    throw new Error(
      'Migration tests require a local database and an isolated generated schema',
    );
  url.searchParams.delete('schema');
  if (url.searchParams.get('sslmode') === 'require')
    url.searchParams.set('uselibpqcompat', 'true');
  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5000,
  });
  const schema = `ocop_migration_test_${randomUUID().replaceAll('-', '')}`;
  let created = false;
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await client.query(`SET search_path TO "${schema}"`);
    for (const folder of readdirSync(migrationDir)
      .filter((name) => /^00(0[1-9]|10)_/.test(name))
      .sort()) {
      await client.query(
        readFileSync(resolve(migrationDir, folder, 'migration.sql'), 'utf8'),
      );
    }
    await client.query(`
      INSERT INTO users (id,email,password,"fullName",role,"updatedAt") VALUES
        ('registrant','r@example.invalid','unused','Registrant','REGISTRANT',now()),
        ('judge','j@example.invalid','unused','Judge','JUDGE',now()),
        ('admin','a@example.invalid','unused','Admin','ADMIN',now());
      INSERT INTO product_categories (id,"groupCode","groupName","classificationGroup",name,"updatedAt")
        VALUES ('category','FOOD','Sản phẩm thực phẩm','legacy','Legacy category',now());
      INSERT INTO criteria_sets (id,"categoryId",name,source,"updatedAt") VALUES ('set','category','Legacy set','Legacy source',now());
      INSERT INTO criteria (id,"setId",code,name,"maxScore","sectionCode","sectionName","order") VALUES ('criterion','set','1','Criterion',100,'A','Section',1);
      INSERT INTO sub_criteria (id,"criterionId",code,content,"order") VALUES ('sub','criterion','1.1','Subcriterion',1);
      INSERT INTO score_options (id,"subCriterionId",label,points,"order") VALUES ('option','sub','Option',100,1);
      INSERT INTO products (id,"registrantId","categoryId",name,"formData",status,"finalScore","starRating","updatedAt")
        VALUES ('product','registrant','category','Legacy product','{}','COMPLETED',100,5,now());
      INSERT INTO attachments (id,"productId",type,"fileName","filePath") VALUES ('attachment','product','EVIDENCE','proof.pdf','private/proof.pdf');
      INSERT INTO judge_assignments ("judgeId","categoryId","criterionIds") VALUES ('judge','category',ARRAY['criterion']);
      INSERT INTO evaluations (id,"judgeId","productId",status,total,"updatedAt") VALUES ('evaluation','judge','product','SUBMITTED',100,now());
      INSERT INTO scores ("evaluationId","subCriterionId","optionId",note) VALUES ('evaluation','sub','option','Legacy note');
    `);
    const tables = [
      'users',
      'product_categories',
      'criteria_sets',
      'criteria',
      'sub_criteria',
      'score_options',
      'products',
      'attachments',
      'judge_assignments',
      'evaluations',
      'scores',
    ];
    const before = new Map<string, Record<string, unknown>[]>();
    for (const table of tables)
      before.set(table, (await client.query(`SELECT * FROM "${table}"`)).rows);
    await client.query(
      readFileSync(
        resolve(migrationDir, '0011_admin_foundation/migration.sql'),
        'utf8',
      ),
    );
    for (const table of tables) {
      const rows = (await client.query(`SELECT * FROM "${table}"`)).rows;
      expect(rows).toHaveLength(before.get(table)!.length);
      for (const row of before.get(table)!)
        expect(rows).toContainEqual(expect.objectContaining(row));
    }
    expect(
      (
        await client.query(
          'SELECT id,"staffPermissions"::text[] AS "staffPermissions","organizationUnitId" FROM users ORDER BY id',
        )
      ).rows,
    ).toEqual([
      {
        id: 'admin',
        staffPermissions: ['MANAGE', 'VIEW'],
        organizationUnitId: null,
      },
      { id: 'judge', staffPermissions: ['SCORE'], organizationUnitId: null },
      { id: 'registrant', staffPermissions: [], organizationUnitId: null },
    ]);
    expect(
      (
        await client.query(
          'SELECT "completedAt","localityId","createdById","localityCodeAtSubmit","localityNameAtSubmit" FROM products',
        )
      ).rows[0],
    ).toEqual({
      completedAt: null,
      localityId: null,
      createdById: null,
      localityCodeAtSubmit: null,
      localityNameAtSubmit: null,
    });
    for (const table of [
      'organization_units',
      'localities',
      'product_status_events',
    ])
      expect((await client.query(`SELECT * FROM "${table}"`)).rows).toEqual([]);
    expect(
      (await client.query('SELECT * FROM product_groups')).rows,
    ).toHaveLength(6);
    expect(
      (await client.query('SELECT "groupId" FROM product_categories')).rows[0]
        .groupId,
    ).toBe('product-group-FOOD');
    const evaluation = (
      await client.query(
        'SELECT "submittedAt","submissionSnapshot" FROM evaluations',
      )
    ).rows[0];
    expect(evaluation.submittedAt).toBeNull();
    expect(evaluation.submissionSnapshot).toEqual({
      schemaVersion: 1,
      provenance: 'PRE_UPGRADE',
      historicalValuesVerified: false,
      submittedAt: null,
      total: 100,
      product: { id: 'product', categoryId: 'category' },
      criteriaSet: {
        id: 'set',
        name: 'Legacy set',
        source: 'Legacy source',
        version: null,
        sourceHash: null,
      },
      judge: { id: 'judge', fullName: 'Judge', organizationUnit: null },
      scope: { criterionIds: ['criterion'] },
      scores: [
        {
          subCriterionId: 'sub',
          optionId: 'option',
          note: 'Legacy note',
          points: 100,
          criterion: {
            id: 'criterion',
            code: '1',
            name: 'Criterion',
            maxScore: 100,
            sectionCode: 'A',
            sectionName: 'Section',
          },
          subCriterion: { code: '1.1', content: 'Subcriterion' },
          option: { label: 'Option', points: 100 },
        },
      ],
    });
    expect(evaluation.submissionSnapshot.judge).not.toHaveProperty('email');
  } finally {
    if (created) await client.query('ROLLBACK');
    if (created) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
});
