import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, metaMask, injected } from 'wagmi/connectors';
import { QueryClient } from '@tanstack/react-query'

const chainId = process.env.NEXT_PUBLIC_SDK_CHAIN_ID
  ? Number(process.env.NEXT_PUBLIC_SDK_CHAIN_ID)
  : baseSepolia.id
  
export const activeChain = chainId === 84532 ? baseSepolia : base
  
export const config = createConfig({
  chains: [activeChain],
  connectors: [
    // Coinbase Wallet - supports both TBA and EOA
    coinbaseWallet({
      appName: 'Ohara',
      preference: 'all',
    }),
    // MetaMask
    metaMask({
      dappMetadata: {
        name: 'Ohara',
      },
    }),
    injected({ target: 'phantom' }),  
    injected({ target: 'rabby' }),  
    injected({ target: 'trust' }),  
  ],
  transports: {  
    [activeChain.id]: http(process.env.RPC_URL),
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5_000,
    },
  },
});
