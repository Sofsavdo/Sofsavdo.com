import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking launch_bonus permissions...');
  
  const permissions = await prisma.permission.findMany({
    where: { key: { startsWith: 'launch_bonus' } }
  });
  
  console.log('Found permissions:', permissions.length);
  console.log('Permissions:', permissions);
  
  if (permissions.length === 0) {
    console.log('No launch_bonus permissions found. Creating them...');
    
    const read = await prisma.permission.create({
      data: { key: 'launch_bonus.read', label: 'launch_bonus.read' }
    });
    const write = await prisma.permission.create({
      data: { key: 'launch_bonus.write', label: 'launch_bonus.write' }
    });
    const verify = await prisma.permission.create({
      data: { key: 'launch_bonus.verify', label: 'launch_bonus.verify' }
    });
    const admin = await prisma.permission.create({
      data: { key: 'launch_bonus.admin', label: 'launch_bonus.admin' }
    });
    
    console.log('Created permissions:', { read, write, verify, admin });
  }
  
  // Always verify and assign to super_admin
  const superAdmin = await prisma.role.findUnique({
    where: { key: 'super_admin' },
    include: { permissions: { include: { permission: true } } }
  });
  
  if (superAdmin) {
    console.log('Super Admin role found:', superAdmin.key);
    console.log('Current permissions:', superAdmin.permissions.length);
    
    const launchBonusPermissionIds = permissions.map(p => p.id);
    const existingPermissionIds = superAdmin.permissions.map(rp => rp.permissionId);
    
    const toAssign = launchBonusPermissionIds.filter(id => !existingPermissionIds.includes(id));
    
    if (toAssign.length > 0) {
      console.log('Assigning missing permissions:', toAssign.length);
      await prisma.rolePermission.createMany({
        data: toAssign.map(permissionId => ({ roleId: superAdmin.id, permissionId })),
        skipDuplicates: true
      });
      console.log('Assigned launch_bonus permissions to super_admin');
    } else {
      console.log('All launch_bonus permissions already assigned to super_admin');
    }
    
    // Verify final count
    const updated = await prisma.role.findUnique({
      where: { key: 'super_admin' },
      include: { permissions: true }
    });
    console.log('Final super_admin permission count:', updated?.permissions.length);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
