export default async function TestDbPage() {
    try {
      const result = await sql`
        SELECT 
          current_database() as db_name,
          current_user as user_name,
          inet_server_addr() as server_addr,
          version() as pg_version
      `;
      
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-4">Database Connection Info</h1>
          <pre className="bg-gray-100 p-4 rounded">
            {JSON.stringify(result.rows[0], null, 2)}
          </pre>
          {/* Optionally, show all rows returned from the database query */}
          <h2 className="text-xl font-semibold mt-8 mb-2">All Result Rows</h2>
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(result.rows, null, 2)}
          </pre>
        </div>
      );
    } catch (error) {
      console.error("Error fetching database info:", error);
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-4">Database Connection Error</h1>
          <pre className="bg-red-50 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      );
    }
  }