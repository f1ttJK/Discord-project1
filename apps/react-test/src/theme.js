import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  colors: {
    discord: {
      50: '#f0f2ff',
      100: '#d9dfff',
      200: '#b3c1ff',
      300: '#8da4ff',
      400: '#6686ff',
      500: '#5865F2', // Discord Blurple
      600: '#4752c4',
      700: '#3c4396',
      800: '#313368',
      900: '#26243a',
    },
    gray: {
      50: '#f7fafc',
      100: '#edf2f7',
      200: '#e2e8f0',
      300: '#cbd5e0',
      400: '#a0aec0',
      500: '#718096',
      600: '#4a5568',
      700: '#2d3748',
      800: '#1a202c',
      900: '#171923',
    },
    dark: {
      50: '#f7fafc',
      100: '#36393f',
      200: '#32353b',
      300: '#2f3136',
      400: '#292b2f',
      500: '#23272a',
      600: '#1e2124',
      700: '#18191c',
      800: '#0f1011',
      900: '#000000',
    }
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'dark.500' : 'white',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
      },
    }),
  },
  components: {
    Card: {
      baseStyle: (props) => ({
        container: {
          bg: props.colorMode === 'dark' ? 'dark.400' : 'white',
          borderColor: props.colorMode === 'dark' ? 'dark.300' : 'gray.200',
          borderWidth: '1px',
          borderRadius: 'xl',
          shadow: props.colorMode === 'dark' ? 'dark-lg' : 'md',
        },
      }),
    },
    Button: {
      variants: {
        discord: (props) => ({
          bg: 'discord.500',
          color: 'white',
          _hover: {
            bg: 'discord.600',
            transform: 'translateY(-1px)',
            shadow: 'lg',
          },
          _active: {
            bg: 'discord.700',
            transform: 'translateY(0)',
          },
          transition: 'all 0.2s',
        }),
        ghost: (props) => ({
          _hover: {
            bg: props.colorMode === 'dark' ? 'dark.300' : 'gray.100',
          },
        }),
      },
    },
    Tabs: {
      variants: {
        enclosed: (props) => ({
          tab: {
            _selected: {
              bg: props.colorMode === 'dark' ? 'dark.300' : 'white',
              borderColor: props.colorMode === 'dark' ? 'dark.200' : 'gray.200',
              borderBottomColor: props.colorMode === 'dark' ? 'dark.300' : 'white',
            },
            _hover: {
              bg: props.colorMode === 'dark' ? 'dark.400' : 'gray.50',
            },
          },
          tabpanel: {
            bg: props.colorMode === 'dark' ? 'dark.300' : 'white',
            borderColor: props.colorMode === 'dark' ? 'dark.200' : 'gray.200',
            borderWidth: '1px',
            borderRadius: 'md',
            borderTopRadius: 0,
          },
        }),
      },
    },
    Alert: {
      variants: {
        subtle: (props) => ({
          container: {
            bg: props.colorMode === 'dark' ? 'dark.400' : 'gray.50',
          },
        }),
      },
    },
  },
  shadows: {
    'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
  },
})

export default theme
