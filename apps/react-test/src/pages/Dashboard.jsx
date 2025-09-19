import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { Link } from 'react-router-dom'
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Avatar,
  Button,
  SimpleGrid,
  Card,
  CardBody,
  Badge,
  Icon,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Flex,
  Spacer
} from '@chakra-ui/react'
import { FiServer, FiSettings, FiUsers, FiShield } from 'react-icons/fi'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [guilds, setGuilds] = useState(null)
  const [err, setErr] = useState(null)
  const [retryInMs, setRetryInMs] = useState(0)
  
  const bgColor = useColorModeValue('gray.50', 'dark.500')
  const cardBg = useColorModeValue('white', 'dark.400')

  useEffect(() => {
    let mounted = true
    let retryTimer = null
    ;(async () => {
      try {
        const data = await api.guilds()
        if (!mounted) return
        let list = data?.guilds || data || []
        // If API provides flags like owner or botPresent, filter; otherwise keep all
        if (Array.isArray(list)) {
          list = list.filter(g => (g.owner === true) || (g.botPresent === true) || (g.permissions & 0x20) !== 0) // MANAGE_GUILD
        }
        setGuilds(list)
        setErr(null)
        setRetryInMs(0)
      } catch (e) {
        // If rate limited, schedule retry
        if (e?.status === 429) {
          const delay = Math.max(800, Number(e?.data?.error?.retryAfterMs) || 1200)
          setRetryInMs(delay)
          retryTimer = setTimeout(() => {
            setRetryInMs(0)
            // trigger refetch by re-running effect
            setGuilds(prev => prev ?? null)
          }, delay)
          // Don't overwrite existing guilds on transient error
          if (!guilds) setErr('Discord временно ограничил запросы. Повтор через ' + Math.round(delay/1000) + 'с')
        } else {
          if (!guilds) setErr(e.message || 'Ошибка')
        }
      }
    })()
    return () => { mounted = false; if (retryTimer) clearTimeout(retryTimer) }
  }, [])

  return (
    <Box minH="100vh" bg={bgColor}>
      <Container maxW="7xl" py={8}>
        {/* Header */}
        <Flex align="center" mb={8} p={6} bg={cardBg} borderRadius="xl" shadow="md">
          <HStack spacing={4}>
            <Avatar
              size="lg"
              src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user?.id}/${user?.avatar}.png?size=128` : undefined}
              name={user?.username}
              bg="discord.500"
            />
            <VStack align="start" spacing={1}>
              <Heading size="lg" color="white">Привет, {user?.username}! 👋</Heading>
              <Text color="gray.400">Управляй своими Discord серверами</Text>
            </VStack>
          </HStack>
          <Spacer />
          <Button onClick={logout} variant="ghost" colorScheme="red">
            Выйти
          </Button>
        </Flex>

        {/* Content */}
        <VStack spacing={6} align="stretch">
          <Box>
            <Heading size="md" mb={4} color="white">🏰 Ваши сервера</Heading>
            
            {err && (
              <Alert status="error" mb={4} borderRadius="md">
                <AlertIcon />
                {err}
              </Alert>
            )}
            
            {retryInMs > 0 && (
              <Alert status="warning" mb={4} borderRadius="md">
                <AlertIcon />
                Повтор запроса через ~{Math.ceil(retryInMs/1000)}с…
              </Alert>
            )}
            
            {!guilds ? (
              <Flex justify="center" py={12}>
                <VStack spacing={4}>
                  <Spinner size="xl" color="discord.500" thickness="4px" />
                  <Text color="gray.400">Загрузка серверов...</Text>
                </VStack>
              </Flex>
            ) : Array.isArray(guilds) && guilds.length === 0 ? (
              <Card bg={cardBg} borderRadius="xl">
                <CardBody textAlign="center" py={12}>
                  <Icon as={FiServer} boxSize={12} color="gray.400" mb={4} />
                  <Text color="gray.400" fontSize="lg">Нет доступных серверов</Text>
                  <Text color="gray.500" fontSize="sm" mt={2}>
                    Убедитесь, что бот добавлен на ваши сервера
                  </Text>
                </CardBody>
              </Card>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                {Array.isArray(guilds) && guilds.map(g => (
                  <Card
                    key={g.id}
                    bg={cardBg}
                    borderRadius="xl"
                    overflow="hidden"
                    transition="all 0.2s"
                    _hover={{
                      transform: 'translateY(-2px)',
                      shadow: 'xl',
                    }}
                    cursor="pointer"
                    as={Link}
                    to={`/guilds/${g.id}`}
                  >
                    <CardBody p={6}>
                      <VStack spacing={4} align="start">
                        <HStack spacing={3} w="full">
                          <Avatar
                            size="md"
                            src={g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : undefined}
                            name={g.name}
                            bg="discord.500"
                          />
                          <VStack align="start" spacing={1} flex={1}>
                            <Text fontWeight="bold" color="white" noOfLines={1}>
                              {g.name || g.id}
                            </Text>
                            <HStack spacing={2}>
                              {g.owner && (
                                <Badge colorScheme="yellow" size="sm">
                                  <Icon as={FiShield} mr={1} />
                                  Владелец
                                </Badge>
                              )}
                              {g.botPresent && (
                                <Badge colorScheme="green" size="sm">
                                  ✓ Бот активен
                                </Badge>
                              )}
                            </HStack>
                          </VStack>
                        </HStack>
                        
                        <HStack spacing={4} w="full" fontSize="sm" color="gray.400">
                          <HStack>
                            <Icon as={FiUsers} />
                            <Text>{g.memberCount || '—'}</Text>
                          </HStack>
                          <Spacer />
                          <Icon as={FiSettings} />
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Box>
        </VStack>
      </Container>
    </Box>
  )
}
