import { PrismaClient } from "@prisma/client";

const passwords = [
  "postgres", "", "root", "admin", "password", "123456", "1234", "Welcome123!",
  "admin123", "postgres123", "root123", "admin@123", "Admin@123", "postgres@123",
  "Postgres@123", "password123", "rootroot", "adminadmin", "12345", "12345678",
  "123456789", "pgadmin", "pgadmin4", "123"
];

async function testConnections() {
  for (const pw of passwords) {
    const url = pw 
      ? `postgresql://postgres:${pw}@localhost:5432/mediassist?schema=public`
      : `postgresql://postgres@localhost:5432/mediassist?schema=public`;
    
    console.log(`Testing: ${url.replace(/:[^@:]*@/, ":****@")}`);
    
    process.env.DATABASE_URL = url;
    const prisma = new PrismaClient({
      datasources: {
        db: { url }
      }
    });

    try {
      await prisma.$connect();
      console.log(`SUCCESS! Working URL: ${url}`);
      await prisma.$disconnect();
      return url;
    } catch (e: any) {
      console.log(`Failed: ${e.message.split('\n')[0]}`);
    } finally {
      await prisma.$disconnect();
    }
  }
  console.log("No working password found.");
  return null;
}

testConnections();
