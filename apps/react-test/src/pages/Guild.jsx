import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Card,
  CardHeader,
  CardBody,
  Switch,
  FormControl,
  FormLabel,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Flex,
  Spacer,
  Badge,
  Icon,
  useToast
} from '@chakra-ui/react'
import { FiSettings, FiArrowLeft, FiTrendingUp } from 'react-icons/fi'

export default function Guild() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  
  const bgColor = useColorModeValue('gray.50', 'dark.500')
  const cardBg = useColorModeValue('white', 'dark.400')
  
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const data = await api.getGuildConfig(id)
        if (!mounted) return
        setCfg(data?.config || data || { guildId: id })
      } catch (e) {
        setError(e.message || 'Ошибка загрузки конфига')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  async function save() {
    try {
      setSaving(true)
      await api.updateGuildConfig(id, cfg)
      toast({
        title: 'Настройки сохранены',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (e) {
      toast({
        title: 'Ошибка сохранения',
        description: e.message || 'Неизвестная ошибка',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLevelingToggle = async (enabled) => {
    const newCfg = { ...cfg, levelingEnabled: enabled }
    setCfg(newCfg)
    try {
      setSaving(true)
      await api.updateGuildConfig(id, newCfg)
      toast({
        title: enabled ? 'Система уровней включена' : 'Система уровней отключена',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (e) {
      setCfg(cfg) // Revert on error
      toast({
        title: 'Ошибка сохранения',
        description: e.message || 'Неизвестная ошибка',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Container maxW="4xl" py={8}>
          <Flex justify="center" align="center" minH="50vh">
            <VStack spacing={4}>
              <Spinner size="xl" color="discord.500" thickness="4px" />
              <Text color="gray.400">Загрузка конфигурации сервера...</Text>
            </VStack>
          </Flex>
        </Container>
      </Box>
    )
  }

  if (error) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Container maxW="4xl" py={8}>
          <VStack spacing={6}>
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
            <Button leftIcon={<FiArrowLeft />} onClick={() => navigate(-1)}>
              Назад к серверам
            </Button>
          </VStack>
        </Container>
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <Container maxW="6xl" py={8}>
        {/* Header */}
        <Flex align="center" justify="space-between" mb={8}>
          <VStack align="start" spacing={1}>
            <Heading size="lg" color="white">
              🛠️ Конфигурация сервера
            </Heading>
            <Text color="gray.400">
              ID: {cfg?.guildId || id}
            </Text>
          </VStack>
          <HStack spacing={3}>
            <Button
              as={Link}
              to={`/guilds/${id}/settings`}
              variant="discord"
              leftIcon={<FiSettings />}
              size="lg"
            >
              Расширенные настройки
            </Button>
            <Button
              leftIcon={<FiArrowLeft />}
              onClick={() => navigate('/dashboard')}
              variant="ghost"
            >
              К серверам
            </Button>
          </HStack>
        </Flex>

        {/* Quick Settings */}
        <VStack spacing={6} align="stretch">
          <Card bg={cardBg} borderRadius="xl" shadow="md">
            <CardHeader>
              <HStack spacing={3}>
                <Icon as={FiTrendingUp} color="discord.500" boxSize={6} />
                <VStack align="start" spacing={1}>
                  <Heading size="md" color="white">Система уровней</Heading>
                  <Text color="gray.400" fontSize="sm">
                    Позволяет участникам получать опыт и повышать уровень
                  </Text>
                </VStack>
                <Spacer />
                <Badge
                  colorScheme={cfg?.levelingEnabled ? 'green' : 'gray'}
                  variant="subtle"
                  px={3}
                  py={1}
                >
                  {cfg?.levelingEnabled ? 'Включено' : 'Отключено'}
                </Badge>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0" color="white" flex={1}>
                  Включить систему уровней для этого сервера
                </FormLabel>
                <Switch
                  colorScheme="discord"
                  size="lg"
                  isChecked={Boolean(cfg?.levelingEnabled)}
                  onChange={(e) => handleLevelingToggle(e.target.checked)}
                  isDisabled={saving}
                />
              </FormControl>
              
              {cfg?.levelingEnabled && (
                <Box mt={4} p={4} bg="discord.50" borderRadius="md" border="1px" borderColor="discord.200">
                  <Text fontSize="sm" color="discord.700">
                    💡 <strong>Совет:</strong> Используйте расширенные настройки для настройки кривой опыта, 
                    наград за уровни и других параметров системы уровней.
                  </Text>
                </Box>
              )}
            </CardBody>
          </Card>

          {/* Additional Quick Settings can be added here */}
          <Card bg={cardBg} borderRadius="xl" shadow="md" opacity={0.7}>
            <CardBody textAlign="center" py={8}>
              <Icon as={FiSettings} boxSize={8} color="gray.400" mb={3} />
              <Text color="gray.400" fontSize="lg" mb={2}>
                Больше настроек скоро появится
              </Text>
              <Text color="gray.500" fontSize="sm">
                Используйте расширенные настройки для полного контроля над ботом
              </Text>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  )
}
