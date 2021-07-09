import { lowercase_keys } from './utils.js';

/** @param {string} body */
function error(body) {
	return {
		status: 500,
		body,
		headers: {}
	};
}

/** @param {string} type */
function is_binary_type(type) {
	return (
		type.startsWith('application') ||
		type.startsWith('image') ||
		type.startsWith('video') ||
		type.startsWith('audio')
	);
}

/**
 * @param {import('types/hooks').ServerRequest} request
 * @param {import('types/internal').SSREndpoint} route
 * @returns {Promise<import('types/hooks').ServerResponse>}
 */
export default async function render_route(request, route) {
	const mod = await route.load();

	/** @type {import('types/endpoint').RequestHandler} */
	const handler = mod[request.method.toLowerCase().replace('delete', 'del')]; // 'delete' is a reserved word

	if (handler) {
		const match = route.pattern.exec(request.path);
		const params = route.params(match);

		const response = await handler({ ...request, params });

		if (response) {
			if (typeof response !== 'object') {
				return error(
					`Invalid response from route ${request.path}: expected an object, got ${typeof response}`
				);
			}

			let { status = 200, body, headers = {} } = response;

			headers = lowercase_keys(headers);
			const type = headers['content-type'];

			// validation
			if (is_binary_type(type) && !(body instanceof Uint8Array)) {
				return error(
					`Invalid response from route ${request.path}: body must be an instance of Uint8Array if content type is application/octet-stream`
				);
			}

			if (body instanceof Uint8Array && !is_binary_type(type)) {
				return error(
					`Invalid response from route ${request.path}: Uint8Array body must be accompanied by content-type: application/octet-stream header`
				);
			}

			/** @type {import('types/hooks').StrictBody} */
			let normalized_body;

			if (
				typeof body === 'object' &&
				(!type || type === 'application/json' || type === 'application/json; charset=utf-8')
			) {
				headers = { ...headers, 'content-type': 'application/json; charset=utf-8' };
				normalized_body = JSON.stringify(body);
			} else {
				normalized_body = /** @type {import('types/hooks').StrictBody} */ (body);
			}

			return { status, body: normalized_body, headers };
		}
	}
}
