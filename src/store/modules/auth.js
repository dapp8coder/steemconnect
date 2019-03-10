import Vue from 'vue';
import { PrivateKey, cryptoUtils } from 'dsteem';
import client from '@/helpers/client';
import { credentialsValid } from '@/helpers/auth';
import router from '@/router';
import { idleDetector } from '@/main';

const state = {
  username: null,
  keys: {},
  account: {},
};

const mutations = {
  saveAccount(_state, { result, keys }) {
    Vue.set(_state, 'username', result.name);
    Vue.set(_state, 'keys', keys);
    Vue.set(_state, 'account', result);
  },
  logout(_state) {
    Vue.set(_state, 'username', null);
    Vue.set(_state, 'keys', {});
    Vue.set(_state, 'account', {});
  },
};

const actions = {
  login: async ({ commit, dispatch, rootState }, { username, keys }) => {
    const key = keys.active || keys.posting || keys.memo;
    const valid = await credentialsValid(username, key);

    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const result = await client.database.getAccounts([username]);
    commit('saveAccount', { result: result[0], keys });

    idleDetector.start(rootState.settings.timeout * 60 * 1000, () => {
      idleDetector.stop();
      dispatch('logout');
    });
  },
  logout: ({ commit }) => {
    commit('logout');
    router.push('/');
  },
  sign: ({ rootState }, tx) => {
    const { keys } = rootState.auth;
    const { chainId } = rootState.settings;
    // @TODO Use lowest key authority
    const privateKey = PrivateKey.fromString(keys.active || keys.posting || keys.memo);
    return cryptoUtils.signTransaction(tx, [privateKey], Buffer.from(chainId, 'hex'));
  },
  signMessage: ({ rootState }, { message, authority }) => {
    const { keys, username } = rootState.auth;
    const messageObj = { signed_message: message, authors: [username] };
    const hash = cryptoUtils.sha256(JSON.stringify(messageObj));
    const key = PrivateKey.fromString(keys[authority]);
    const signature = key.sign(hash).toString();
    messageObj.signatures = [signature];
    return messageObj;
  },
  broadcast: (context, tx) => client.broadcast.send(tx),
};

export default {
  state,
  mutations,
  actions,
};
