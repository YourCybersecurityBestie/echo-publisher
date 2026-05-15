import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Echo Publisher API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`;

export async function docs(_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: SWAGGER_HTML
  };
}

app.http('docs', {
  route: 'docs',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: docs
});
