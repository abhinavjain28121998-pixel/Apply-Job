# Security Specification & Threat Model

## 1. Data Invariants

1. **User Isolation**: A user may only read, create, update, or delete their own user profile document (`/users/{userId}` where `userId == request.auth.uid`).
2. **Saved Jobs Ownership**: A saved job document (`/saved_jobs/{docId}`) must have `userId == request.auth.uid`. Non-owners cannot read, create, update, or delete other users' saved jobs.
3. **Job Match Ownership**: A job match analysis (`/job_matches/{docId}`) must belong to the authenticated user (`userId == request.auth.uid`).
4. **Application Record Isolation**: An application record (`/applications/{docId}`) can only be accessed or modified by its owner (`userId == request.auth.uid`).
5. **No Anonymous/Unauthenticated Access**: All database operations require authenticated credentials (`request.auth != null`).
6. **Existence Resilience**: Checking non-existent documents for a user (e.g. initial `getDoc` before a match or saved job is created) must not trigger permission denial errors when queried within the user's scope.
7. **Query Scoping**: Collection-level queries (`list`) must explicitly evaluate `resource.data.userId == request.auth.uid`.

## 2. The Dirty Dozen Payloads

1. **Unauthenticated Read on `/saved_jobs`**: Attempting `getDocs(query(collection('saved_jobs')))` without `request.auth` must be rejected with `PERMISSION_DENIED`.
2. **Cross-User Profile Read**: User `alice` attempting to read `/users/bob` must be rejected.
3. **Cross-User Profile Write**: User `alice` attempting to write `/users/bob` with spoofed `userId` must be rejected.
4. **Cross-User Saved Job Read**: User `alice` attempting to read `/saved_jobs/bob_job123` must be rejected.
5. **Cross-User Saved Job Create**: User `alice` attempting to create `/saved_jobs/bob_job123` with `userId: 'bob'` must be rejected.
6. **Cross-User Saved Job Update**: User `alice` attempting to update `/saved_jobs/bob_job123` must be rejected.
7. **Cross-User Saved Job Delete**: User `alice` attempting to delete `/saved_jobs/bob_job123` must be rejected.
8. **Cross-User Application Read**: User `alice` querying `/applications` belonging to `bob` must be rejected.
9. **Cross-User Application Status Tampering**: User `alice` attempting to update `status` on `/applications/app_of_bob` must be rejected.
10. **Cross-User Match Report Read**: User `alice` attempting to read `/job_matches/bob_job123` must be rejected.
11. **Cross-User Match Report Create**: User `alice` attempting to write `/job_matches/bob_job123` must be rejected.
12. **Catch-All Default Deny**: Accessing arbitrary unknown collections such as `/secrets` or `/system_config` must be rejected.
