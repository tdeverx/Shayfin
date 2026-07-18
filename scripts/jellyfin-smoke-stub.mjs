import { createServer } from 'node:http';

const port = Number(process.env.SHAYFIN_SMOKE_JELLYFIN_PORT ?? 18096);

function tokenFrom(request) {
	const direct = request.headers['x-emby-token'];
	if (typeof direct === 'string') return direct;
	const authorization = request.headers.authorization ?? '';
	return authorization.match(/(?:Token=|Token=")([^", ]+)/i)?.[1] ?? '';
}

const server = createServer((request, response) => {
	const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Content-Type', 'application/json');

	if (url.pathname === '/System/Info/Public') {
		response.end(
			JSON.stringify({ Id: 'smoke-jellyfin', ServerName: 'Smoke Jellyfin', Version: '10.11.11' })
		);
		return;
	}

	if (url.pathname === '/Users/Me') {
		const token = tokenFrom(request);
		if (token !== 'admin-token' && token !== 'user-token') {
			response.statusCode = 401;
			response.end(JSON.stringify({ error: 'invalid token' }));
			return;
		}
		response.end(
			JSON.stringify({
				Id: token === 'admin-token' ? 'smoke-admin' : 'smoke-user',
				Name: token === 'admin-token' ? 'Smoke Admin' : 'Smoke User',
				Policy: { IsAdministrator: token === 'admin-token' }
			})
		);
		return;
	}

	if (url.pathname === '/api/v1/status') {
		if (request.headers['x-api-key'] !== 'smoke-secret-key') {
			response.statusCode = 401;
			response.end(JSON.stringify({ error: 'invalid API key' }));
			return;
		}
		response.end(JSON.stringify({ version: '3.3.0' }));
		return;
	}

	response.statusCode = 404;
	response.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, '0.0.0.0', () => {
	console.log(`Smoke Jellyfin listening on ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => server.close(() => process.exit(0)));
}
