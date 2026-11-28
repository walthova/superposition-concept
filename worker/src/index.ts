import { handleRequest, type WorkerEnv } from './handler';

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
