import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Switch,
  FormControl,
  FormLabel,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
  Button,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Card,
  CardHeader,
  CardBody,
  Spinner,
  Alert,
  AlertIcon,
  Divider,
  Badge,
  Input
} from '@chakra-ui/react'
import { api } from '../lib/api'

export default function GuildSettings() {
  const { id: guildId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [guildId])

  const loadConfig = async () => {
    if (!guildId || guildId === 'undefined') {
      setError('Invalid guild ID')
      setLoading(false)
      navigate('/dashboard')
      return
    }
    
    try {
      setLoading(true)
      const data = await api.getGuildConfig(guildId)
      setConfig(data.config || {})
      setError(null)
    } catch (err) {
      setError(err.message)
      if (err.status === 403 || err.status === 404) {
        navigate('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (updates) => {
    try {
      setSaving(true)
      const updatedConfig = { ...config, ...updates }
      await api.updateGuildConfig(guildId, updatedConfig)
      setConfig(updatedConfig)
      
      toast({
        title: 'Настройки сохранены',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (err) {
      toast({
        title: 'Ошибка сохранения',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field) => (value) => {
    const updates = { [field]: value }
    setConfig(prev => ({ ...prev, ...updates }))
    saveConfig(updates)
  }

  const handleChange = (field) => (value) => {
    const updates = { [field]: value }
    setConfig(prev => ({ ...prev, ...updates }))
    saveConfig(updates)
  }

  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Загрузка настроек...</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={8}>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
        <Button mt={4} onClick={() => navigate('/dashboard')}>
          Вернуться к серверам
        </Button>
      </Box>
    )
  }

  return (
    <Box p={8} maxW="1200px" mx="auto">
      <HStack justify="space-between" mb={8}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">🛠️ Настройки сервера</Heading>
          <Text color="gray.600">Управление функциями Discord бота</Text>
        </VStack>
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          ← Назад к серверам
        </Button>
      </HStack>

      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>📈 Уровни</Tab>
          <Tab>⚠️ Предупреждения</Tab>
          <Tab>🔇 Мут</Tab>
          <Tab>💰 Экономика</Tab>
          <Tab>⚙️ Общие</Tab>
        </TabList>

        <TabPanels>
          {/* Leveling Tab */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">🎯 Система уровней</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">
                        Включить систему уровней
                        <Badge ml={2} colorScheme={config.levelingEnabled ? 'green' : 'red'}>
                          {config.levelingEnabled ? 'Включено' : 'Выключено'}
                        </Badge>
                      </FormLabel>
                      <Switch
                        isChecked={config.levelingEnabled || false}
                        onChange={(e) => handleToggle('levelingEnabled')(e.target.checked)}
                        isDisabled={saving}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Кривая опыта</FormLabel>
                      <Select
                        value={config.curve || 'linear'}
                        onChange={(e) => handleChange('curve')(e.target.value)}
                        isDisabled={saving}
                      >
                        <option value="linear">Линейная</option>
                        <option value="exponential">Экспоненциальная</option>
                        <option value="logarithmic">Логарифмическая</option>
                      </Select>
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          {/* Warnings Tab */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">⚠️ Система предупреждений</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">
                        Включить предупреждения
                        <Badge ml={2} colorScheme={config.warnsEnabled ? 'green' : 'red'}>
                          {config.warnsEnabled ? 'Включено' : 'Выключено'}
                        </Badge>
                      </FormLabel>
                      <Switch
                        isChecked={config.warnsEnabled !== false}
                        onChange={(e) => handleToggle('warnsEnabled')(e.target.checked)}
                        isDisabled={saving}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Максимальное количество предупреждений</FormLabel>
                      <NumberInput
                        value={config.maxWarns || 3}
                        min={1}
                        max={10}
                        onChange={(value) => handleChange('maxWarns')(parseInt(value))}
                        isDisabled={saving}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Срок действия предупреждений (дни, 0 = навсегда)</FormLabel>
                      <NumberInput
                        value={Math.floor((config.warnExpiry || 0) / 86400)}
                        min={0}
                        max={365}
                        onChange={(value) => handleChange('warnExpiry')(parseInt(value) * 86400)}
                        isDisabled={saving}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          {/* Mute Tab */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">🔇 Система мутов</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">
                        Включить систему мутов
                        <Badge ml={2} colorScheme={config.muteEnabled !== false ? 'green' : 'red'}>
                          {config.muteEnabled !== false ? 'Включено' : 'Выключено'}
                        </Badge>
                      </FormLabel>
                      <Switch
                        isChecked={config.muteEnabled !== false}
                        onChange={(e) => handleToggle('muteEnabled')(e.target.checked)}
                        isDisabled={saving}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>ID роли для мута (оставьте пустым для автосоздания)</FormLabel>
                      <Input
                        value={config.muteRole || ''}
                        onChange={(e) => handleChange('muteRole')(e.target.value)}
                        placeholder="123456789012345678"
                        isDisabled={saving}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Максимальная длительность мута (часы, 0 = без ограничений)</FormLabel>
                      <NumberInput
                        value={Math.floor((config.maxMuteDuration || 86400) / 3600)}
                        min={0}
                        max={8760}
                        onChange={(value) => handleChange('maxMuteDuration')(parseInt(value) * 3600)}
                        isDisabled={saving}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          {/* Economy Tab */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">💰 Экономическая система</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">
                        Включить экономику
                        <Badge ml={2} colorScheme={config.economyEnabled ? 'green' : 'red'}>
                          {config.economyEnabled ? 'Включено' : 'Выключено'}
                        </Badge>
                      </FormLabel>
                      <Switch
                        isChecked={config.economyEnabled || false}
                        onChange={(e) => handleToggle('economyEnabled')(e.target.checked)}
                        isDisabled={saving}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Ежедневная награда</FormLabel>
                      <NumberInput
                        value={config.dailyReward || 100}
                        min={0}
                        max={10000}
                        onChange={(value) => handleChange('dailyReward')(parseInt(value))}
                        isDisabled={saving}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>

                    <HStack spacing={4}>
                      <FormControl>
                        <FormLabel>Минимальная награда за работу</FormLabel>
                        <NumberInput
                          value={config.workReward?.min || 50}
                          min={0}
                          max={1000}
                          onChange={(value) => handleChange('workReward')({ 
                            ...config.workReward, 
                            min: parseInt(value) 
                          })}
                          isDisabled={saving}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Максимальная награда за работу</FormLabel>
                        <NumberInput
                          value={config.workReward?.max || 200}
                          min={0}
                          max={1000}
                          onChange={(value) => handleChange('workReward')({ 
                            ...config.workReward, 
                            max: parseInt(value) 
                          })}
                          isDisabled={saving}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </FormControl>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>

          {/* General Tab */}
          <TabPanel>
            <VStack spacing={6} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">🌐 Основные настройки</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Язык</FormLabel>
                      <Select
                        value={config.locale || 'ru'}
                        onChange={(e) => handleChange('locale')(e.target.value)}
                        isDisabled={saving}
                      >
                        <option value="ru">Русский</option>
                        <option value="en">English</option>
                        <option value="uk">Українська</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Часовой пояс</FormLabel>
                      <Select
                        value={config.timezone || 'Europe/Moscow'}
                        onChange={(e) => handleChange('timezone')(e.target.value)}
                        isDisabled={saving}
                      >
                        <option value="Europe/Moscow">Москва (UTC+3)</option>
                        <option value="Europe/Kiev">Киев (UTC+2)</option>
                        <option value="Europe/London">Лондон (UTC+0)</option>
                        <option value="America/New_York">Нью-Йорк (UTC-5)</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel>ID канала для логов</FormLabel>
                      <Input
                        value={config.logChannel || ''}
                        onChange={(e) => handleChange('logChannel')(e.target.value)}
                        placeholder="123456789012345678"
                        isDisabled={saving}
                      />
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Heading size="md">👋 Приветствие новых участников</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">
                        Включить приветствие
                        <Badge ml={2} colorScheme={config.welcomeEnabled ? 'green' : 'red'}>
                          {config.welcomeEnabled ? 'Включено' : 'Выключено'}
                        </Badge>
                      </FormLabel>
                      <Switch
                        isChecked={config.welcomeEnabled || false}
                        onChange={(e) => handleToggle('welcomeEnabled')(e.target.checked)}
                        isDisabled={saving}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>ID канала для приветствий</FormLabel>
                      <Input
                        value={config.welcomeChannel || ''}
                        onChange={(e) => handleChange('welcomeChannel')(e.target.value)}
                        placeholder="123456789012345678"
                        isDisabled={saving}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Сообщение приветствия</FormLabel>
                      <Textarea
                        value={config.welcomeMessage || ''}
                        onChange={(e) => handleChange('welcomeMessage')(e.target.value)}
                        placeholder="Добро пожаловать на сервер, {user}!"
                        maxLength={2000}
                        isDisabled={saving}
                      />
                      <Text fontSize="sm" color="gray.500" mt={1}>
                        Используйте {'{user}'} для упоминания пользователя
                      </Text>
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {saving && (
        <Box position="fixed" top={4} right={4} zIndex={1000}>
          <Alert status="info" borderRadius="md">
            <Spinner size="sm" mr={2} />
            Сохранение...
          </Alert>
        </Box>
      )}
    </Box>
  )
}
