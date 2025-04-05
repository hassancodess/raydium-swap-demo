import {
  ApiV3PoolInfoStandardItem,
  AmmV4Keys,
  AmmRpcData,
} from '@raydium-io/raydium-sdk-v2'
import { initSdk, txVersion } from './config'
import BN from 'bn.js'
import { isValidAmm } from './utils'
import Decimal from 'decimal.js'
import { NATIVE_MINT } from '@solana/spl-token'

export const swap = async () => {
  const start = Date.now()
  const raydium = await initSdk()
  const amountIn = 0.0001 * Math.pow(10, 9)
  const inputMint = NATIVE_MINT.toBase58()
  const poolId = '58fzJMbX5PatnfJPqWWsqkVFPRKptkbb5r2vCw4Qq3z9'

  let poolInfo: ApiV3PoolInfoStandardItem | undefined
  let poolKeys: AmmV4Keys | undefined
  let rpcData: AmmRpcData

  if (raydium.cluster === 'mainnet') {
    // note: api doesn't support get devnet pool info, so in devnet else we go rpc method
    // if you wish to get pool info from rpc, also can modify logic to go rpc method directly
    // Fetch all data in parallel instead of sequentially
    const [poolData, ammPoolKeys, rpcPoolInfo] = await Promise.all([
      raydium.api.fetchPoolById({ ids: poolId }),
      raydium.liquidity.getAmmPoolKeys(poolId),
      raydium.liquidity.getRpcPoolInfo(poolId),
    ])

    poolInfo = poolData[0] as ApiV3PoolInfoStandardItem
    console.log('🚀 ~ swap ~ poolInfo:', poolInfo)

    if (!isValidAmm(poolInfo.programId)) {
      throw new Error('target pool is not AMM pool')
    }

    const end = Date.now()
    const elapsed = end - start
    console.log(`Pool data fetched in ${elapsed} ms`)

    poolKeys = ammPoolKeys
    rpcData = rpcPoolInfo
  } else {
    // note: getPoolInfoFromRpc method only return required pool data for computing not all detail pool info
    const data = await raydium.liquidity.getPoolInfoFromRpc({ poolId })
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
    rpcData = data.poolRpcData
  }
  const [baseReserve, quoteReserve, status] = [
    rpcData.baseReserve,
    rpcData.quoteReserve,
    rpcData.status.toNumber(),
  ]

  if (
    poolInfo.mintA.address !== inputMint &&
    poolInfo.mintB.address !== inputMint
  )
    throw new Error('input mint does not match pool')

  const baseIn = inputMint === poolInfo.mintA.address
  const [mintIn, mintOut] = baseIn
    ? [poolInfo.mintA, poolInfo.mintB]
    : [poolInfo.mintB, poolInfo.mintA]

  const out = raydium.liquidity.computeAmountOut({
    poolInfo: {
      ...poolInfo,
      baseReserve,
      quoteReserve,
      status,
      version: 4,
    },
    amountIn: new BN(amountIn),
    mintIn: mintIn.address,
    mintOut: mintOut.address,
    slippage: 0.01, // range: 1 ~ 0.0001, means 100% ~ 0.01%
  })

  console.log(
    `computed swap ${new Decimal(amountIn)
      .div(10 ** mintIn.decimals)
      .toDecimalPlaces(mintIn.decimals)
      .toString()} ${mintIn.symbol || mintIn.address} to ${new Decimal(
      out.amountOut.toString()
    )
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)
      .toString()} ${
      mintOut.symbol || mintOut.address
    }, minimum amount out ${new Decimal(out.minAmountOut.toString())
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)} ${mintOut.symbol || mintOut.address}`
  )

  // const { execute } = await raydium.liquidity.swap({
  //   poolInfo,
  //   poolKeys,
  //   amountIn: new BN(amountIn),
  //   amountOut: out.minAmountOut, // out.amountOut means amount 'without' slippage
  //   fixedSide: 'in',
  //   inputMint: mintIn.address,
  //   txVersion,
  // })

  // // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
  // const { txId } = await execute()
  // console.log(`swap successfully in amm pool:`, {
  //   txId: `https://solscan.io/tx/${txId}`,
  // })
  const end = Date.now()
  const elapsed = end - start
  console.log(`Swap completed in ${elapsed} ms`)
  process.exit() // if you don't want to end up node execution, comment this line
}

swap()
