
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'superadmin@aurianoa.com' },
      include: {
        organization: true,
        user_roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('--- User Info ---');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Is Super Admin Flag:', user.is_super_admin);
    console.log('Organization:', user.organization.name, '(', user.organization.slug, ')');
    console.log('--- Roles in Organiation ---');
    if (user.user_roles.length === 0) {
      console.log('No roles assigned in this organization.');
    } else {
      user.user_roles.forEach(ur => {
        console.log(`- ${ur.role.name} (${ur.role.slug})`);
      });
    }

    // Check all organizations for this user
    const allUserRoles = await prisma.userRole.findMany({
      where: { user_id: user.id },
      include: {
        organization: true,
        role: true
      }
    });

    console.log('--- Roles Across All Organizations ---');
    allUserRoles.forEach(ur => {
      console.log(`- Org: ${ur.organization.name} | Role: ${ur.role.name} (${ur.role.slug})`);
    });

  } catch (err) {
    console.error('Error during database query:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
