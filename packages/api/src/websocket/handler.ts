import { FastifyInstance } from 'fastify';

let _fastify: FastifyInstance | null = null;

export function setWsInstance(fastify: FastifyInstance): void {
  _fastify = fastify;
}

export function broadcast(event: string, data: any): void {
  if (!_fastify?.websocketServer) return;
  const message = JSON.stringify({ event, data });
  for (const client of _fastify.websocketServer.clients) {
    if (client.readyState === 1) client.send(message);
  }
}
