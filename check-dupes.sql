SELECT email, COUNT(*) as count FROM "User" WHERE deleted_at IS NULL GROUP BY email HAVING COUNT(*) > 1;
