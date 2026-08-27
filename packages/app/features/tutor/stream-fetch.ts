// TS resolution anchor — bundlers load the .native/.web forks.
// Web streams out of the box; native needs nitro-fetch's streaming transport.
export { streamFetch } from './stream-fetch.web';
