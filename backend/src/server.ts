
import SQLite, { Database as SQLiteDatabase } from 'better-sqlite3'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import Subzero, { SubzeroError, getIntrospectionQuery, Env, fmtContentRangeHeader, statusFromPgErrorCode } from '@subzerocloud/nodejs'
import * as http from 'http'
import * as https from 'https'
import { Router } from 'itty-router'

type DbType = 'sqlite' | 'postgres'

dotenv.config()
const router = Router()

// get the name of the directory where all the sqlite files will be stored
if (!process.env.DB_PATH) {
    console.error('The DB_PATH environment variable is not set, exiting...');
    process.exit(0);
}
const sqliteDbsPath = process.env.DB_PATH || '/data';
const serverHost = process.env.SERVER_HOST || 'localhost';
const serverPort = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 4000;
const maxRows = process.env.MAX_ROWS ? parseInt(process.env.MAX_ROWS) : 1000;
// check if the directory exists
if (!fs.existsSync(sqliteDbsPath)) {
    // exit with error
    console.error(`The database directory does not exist: ${sqliteDbsPath}`);
    process.exit(1);
}

// a hash map holding all the database connections
let registryInitialized = false
const dbRegistry: {
    [key: string]: {
        name: string;
        type: DbType;
        db: SQLiteDatabase;
        description: string;
        subzeroBackend: Subzero;
        schema: any;
        publicSchemas?: string[];
    }
    
} = {};

async function getRegistryEntryForDb(type: DbType, db_connection_string: string) {
    // switch based on the database type
    switch (type) {
        case 'sqlite':
            const dbPath = path.parse(db_connection_string)
            const directory = dbPath.dir
            const filename = dbPath.base
            const db = new SQLite(`${directory}/${filename}`)
            const name = filename.replace('.db', '')
            let description = name
            const descriptionFile = `${directory}/${name}.txt`
            if (fs.existsSync(descriptionFile)) {
                description = fs.readFileSync(descriptionFile, 'utf8')
            }
            const { query /*, parameters*/ } = getIntrospectionQuery('sqlite', 'public')
            const result = db.prepare(query).get()
            const schema = JSON.parse(result.json_schema)
            const subzeroBackend = new Subzero('sqlite', schema)
            delete schema.use_internal_permissions
            return { name, db, description, subzeroBackend, schema, type }
        default:
            throw new Error(`Unsupported database type: ${type}`)
    }
}

async function initDbRegistry() {
    console.log(`Initializing database registry...`)
    // get all the *.db files in the directory
    const dbFiles = fs.readdirSync(sqliteDbsPath).filter((file) => file.endsWith('.db'));
    // add dbRegistry entries for each db file
    dbFiles.forEach(async (file) => {
        const db_connection_string = `${sqliteDbsPath}/${file}`
        const entry = await getRegistryEntryForDb('sqlite', db_connection_string)
        dbRegistry[entry.name] = entry
    })
    console.log(`Initialized database registry with ${dbFiles.length} entries`)

    registryInitialized = true
}

// routes
// return the dbRegistryMetadata
router.get('/', async (_, res) => {
    const dbRegistryMetadata = Object.keys(dbRegistry).map((key) => {
        const entry = dbRegistry[key]
        return {
            name: entry.name,
            description: entry.description,
            endpoint: `/${entry.name}`,
        }
    })
    res.writeHead(200).end(JSON.stringify(dbRegistryMetadata))
    return res
})

// health check
router.get('/up', async (_, res) => {
    res.writeHead(200).end('OK')
    return res
})

// return the schema for a database
router.get('/:db/schema', async (req, res) => {
    const db = req.params.db
    if (!dbRegistry[db]) {
        throw new SubzeroError(`Database not found: ${db}`, 406)
    }
    res.writeHead(200).end(JSON.stringify(dbRegistry[db].schema))
    return res
})

// route that handles all the queries using the subzero library
router.get('/:db/:url_schema_param?/:table', async (req, res, context) => {
    const db = req.params.db
    const entry = dbRegistry[db]
    if (!entry) {
        throw new SubzeroError(`Database not found: ${db}`, 406)
    }
    const method = req.method || 'GET'
    const url = new URL(req.url)
    const role = context.role
    const header_schema = req.headers['accept-profile'] || req.headers['content-profile']
    let { url_schema_param } = req.params
    const url_schema = url_schema_param === 'rpc' ? undefined : url_schema_param
    const defaultSchema = entry.publicSchemas ? entry.publicSchemas[0] : 'public'
    const schema = url_schema || header_schema || defaultSchema
    if (entry.publicSchemas && !entry.publicSchemas.includes(schema)) {
        throw new SubzeroError(`Schema '${schema}' not found`, 406, `The schema must be one of the following: ${entry.publicSchemas.join(', ')}`)
    }
    let queryEnv: Env = [
        ['role', role],
        ['request.method', method],
        ['request.headers', JSON.stringify(req.headers)],
        ['request.get', JSON.stringify(Object.fromEntries(url.searchParams))],
        ['request.jwt.claims', JSON.stringify(context.jwt_claims || {})],
    ]


    const prefix = `/${db}/${url_schema ? url_schema + '/' : ''}`
    let result
    switch (entry.type) {
        case 'sqlite':
            const subzero = entry.subzeroBackend
            const { query, parameters } = await subzero.fmtStatement(schema, prefix, role, req, queryEnv, maxRows)
            result = entry.db.prepare(query).get(parameters)
            break
    }
    const status = Number(result.status) || 200
    const pageTotal = Number(result.page_total) || 0
    const totalResultSet = Number(result.total_result_set) || undefined
    const offset = Number(url.searchParams.get('offset') || '0') || 0
    let response_headers = result.response_headers?JSON.parse(result.response_headers):{}
    response_headers['content-length'] = Buffer.byteLength(result.body)
    response_headers['content-type'] = 'application/json'
    response_headers['range-unit'] = 'items'
    response_headers['content-range'] = fmtContentRangeHeader(offset, offset + pageTotal - 1, totalResultSet)
    res.writeHead(status, response_headers).end(result.body)
    return res
})

router.all('*', async (_, res) => {
    res.writeHead(404, {
        'content-type': 'application/json',
    }).end(JSON.stringify({ message: 'Not Found' }))
    return res
})

// create the server
// if in development mode import office-addin-dev-certs
const serverOptions = {}
let serveHttps = false
if (process.env.NODE_ENV === 'development') {
    (async function () {
        try {
            const devCertsAddin = await import('office-addin-dev-certs');
            const httpsOptions = await devCertsAddin.getHttpsServerOptions();
            Object.assign(serverOptions, httpsOptions);
            serveHttps = true

        } catch (err) {
            console.error('Error while installing dev certificates.')
            console.error(err)
        }
    })();
}
async function handleRequest(req:http.IncomingMessage, res:http.ServerResponse){
    // respond to request
    try {
        if (!registryInitialized) {
            throw new SubzeroError('Database registry not initialized', 503)
        }
        // this line is needed to make the itty-router work with NodeJS request objects
        if (req.url && req.url[0] === '/') req.url = `http://${req.headers.host}${req.url}`

        // create a context object
        // this object is passed to the handlers
        const context: any = {
            role: 'anonymous',
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
        res.setHeader('Access-Control-Max-Age', 2592000); // 30 days

        //@ts-ignore
        await router.handle(req, res, context)
    
    } catch (e: any) {
        // handle errors thrown by the route handlers
        // console.error(e)
        if (e instanceof SubzeroError) {
            res.writeHead(e.status, {
                'content-type': 'application/json',
            }).end(e.toJSONString())
        }
        else if (e.severity && e.code) {
            // this is a Postgres error
            const status = statusFromPgErrorCode(e.code)
            res.writeHead(status, {
                'content-type': 'application/json',
            }).end(JSON.stringify({ message: e.message, detail: e.detail, hint: e.hint }))
        }
        else {
            res.writeHead(500, {
                'content-type': 'application/json',
            }).end(JSON.stringify({ message: e.message }))
        }
    }
}
const server = serveHttps ? https.createServer(serverOptions, handleRequest) : http.createServer(serverOptions, handleRequest)

server.listen(serverPort, serverHost, undefined, async () => {
    try {
        await initDbRegistry()
        const protocol = serveHttps ? 'https' : 'http'
        console.log(`Server is running on ${protocol}://${serverHost}:${serverPort}`);
    } catch (e) {
        console.error(`Failed to initialize: ${e}`)
    }
})





