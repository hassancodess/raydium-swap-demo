import {
  Raydium,
  TxVersion,
  parseTokenAccountResp,
} from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'
import { env } from './env'

export const owner: Keypair = Keypair.fromSecretKey(
  bs58.decode(env.WALLET_PRIVATE_KEY!)
)
export const connection = new Connection(env.RPC_URL!)
export const txVersion = TxVersion.V0
const cluster = 'mainnet'

let raydium: Raydium | undefined

export const initSdk = async (params?: { loadToken?: boolean }) => {
  if (raydium) return raydium
  console.log('🚀 ~ initSdk ~ connection.rpcEndpoint:', connection.rpcEndpoint)
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.warn(
      'using free rpc node might cause unexpected error, strongly suggest uses paid rpc node'
    )
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
  })
  return raydium
}

export const fetchTokenAccountData = async () => {
  const solAccountResp = await connection.getAccountInfo(owner.publicKey)
  const tokenAccountResp = await connection.getTokenAccountsByOwner(
    owner.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  )
  const token2022Req = await connection.getTokenAccountsByOwner(
    owner.publicKey,
    { programId: TOKEN_2022_PROGRAM_ID }
  )
  const tokenAccountData = parseTokenAccountResp({
    owner: owner.publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  })
  return tokenAccountData
}
