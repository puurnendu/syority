SELECT email, COUNT(*) FROM "User" GROUP BY email HAVING COUNT(*) > 1;
