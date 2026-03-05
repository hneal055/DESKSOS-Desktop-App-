import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Globe, Server, Wifi, CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';

interface NetworkConfig {
  hostname: string;
  ipv4: string;
  ipv6: string;
  gateway: string;
  dns: string;
  mac: string;
  dhcp: boolean;
}

interface DiagnosticResult {
  name: string;
  status: 'success' | 'failed' | 'running';
  message: string;
  attempts: number;
}

const NetworkDiagnostics: React.FC = () => {
  console.log('🔧 NetworkDiagnostics component mounted!'); // ⭐ ADD THIS

  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Auto-load on component mount
    loadNetworkConfig();
  }, []);

  const loadNetworkConfig = async () => {
    setLoading(true);
    setIsExpanded(true); // Auto-expand when diagnostics run
    
    try {
      // Get network configuration from ipconfig
      const result = await invoke<string>('execute_command', { 
        command: 'ipconfig /all' 
      });
      
      // Parse the result
      const lines = result.split('\n');
      
      const hostname = lines.find(l => l.includes('Host Name'))
        ?.split(':')[1]?.trim() || 'Unknown';
      
      const ipv4Match = lines.find(l => l.includes('IPv4 Address'));
      const ipv4 = ipv4Match 
        ? ipv4Match.split(':')[1]?.trim().replace('(Preferred)', '').trim() 
        : 'N/A';
      
      const ipv6Match = lines.find(l => l.includes('IPv6 Address'));
      const ipv6 = ipv6Match 
        ? ipv6Match.split(':')[1]?.trim().replace('(Preferred)', '').trim() 
        : 'N/A';
      
      const gatewayMatch = lines.find(l => l.includes('Default Gateway'));
      const gateway = gatewayMatch 
        ? gatewayMatch.split(':')[1]?.trim() 
        : 'N/A';
      
      const dnsMatch = lines.find(l => l.includes('DNS Servers'));
      const dns = dnsMatch 
        ? dnsMatch.split(':')[1]?.trim() 
        : 'N/A';
      
      const macMatch = lines.find(l => l.includes('Physical Address'));
      const mac = macMatch 
        ? macMatch.split(':')[1]?.trim() 
        : 'N/A';
      
      const dhcp = lines.some(l => l.includes('DHCP Enabled') && l.includes('Yes'));

      setConfig({ hostname, ipv4, ipv6, gateway, dns, mac, dhcp });
      
      // Run diagnostics automatically
      if (gateway && gateway !== 'N/A') {
        await runDiagnostics(gateway);
      }
    } catch (error) {
      console.error('Failed to load network config:', error);
      setDiagnostics([{
        name: 'Network Configuration',
        status: 'failed',
        message: `Error: ${error}`,
        attempts: 0
      }]);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async (gateway: string) => {
    // Initialize diagnostic tests
    setDiagnostics([
      { name: 'Gateway Ping', status: 'running', message: 'Testing gateway connectivity...', attempts: 0 }
    ]);

    try {
      // Test 1: Ping Gateway
      const pingResult = await invoke<string>('execute_command', {
        command: `ping -n 4 ${gateway}`
      });

      const success = pingResult.includes('Reply from');
      const lostPackets = pingResult.match(/Lost = (\d+)/)?.[1] || '0';
      
      setDiagnostics(prev => prev.map(d => 
        d.name === 'Gateway Ping' 
          ? {
              ...d,
              status: success ? 'success' : 'failed',
              message: success 
                ? `Gateway reachable (${lostPackets} packets lost)` 
                : 'Gateway unreachable',
              attempts: parseInt(lostPackets)
            }
          : d
      ));

      // Test 2: DNS Resolution
      setDiagnostics(prev => [...prev, {
        name: 'DNS Resolution',
        status: 'running',
        message: 'Testing DNS servers...',
        attempts: 0
      }]);

      const dnsResult = await invoke<string>('execute_command', {
        command: 'nslookup google.com'
      });

      const dnsSuccess = dnsResult.includes('Address:') && !dnsResult.includes('server failed');
      
      setDiagnostics(prev => prev.map(d => 
        d.name === 'DNS Resolution' 
          ? {
              ...d,
              status: dnsSuccess ? 'success' : 'failed',
              message: dnsSuccess ? 'DNS working correctly' : 'DNS resolution failed',
              attempts: 0
            }
          : d
      ));

      // Test 3: Internet Connectivity
      setDiagnostics(prev => [...prev, {
        name: 'Internet Connectivity',
        status: 'running',
        message: 'Testing internet connection...',
        attempts: 0
      }]);

      const internetResult = await invoke<string>('execute_command', {
        command: 'ping -n 2 8.8.8.8'
      });

      const internetSuccess = internetResult.includes('Reply from');
      
      setDiagnostics(prev => prev.map(d => 
        d.name === 'Internet Connectivity' 
          ? {
              ...d,
              status: internetSuccess ? 'success' : 'failed',
              message: internetSuccess ? 'Connected to internet' : 'No internet connection',
              attempts: 0
            }
          : d
      ));

    } catch (error) {
      setDiagnostics(prev => [...prev, {
        name: 'Diagnostic Error',
        status: 'failed',
        message: `Error running diagnostics: ${error}`,
        attempts: 0
      }]);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Globe className="w-6 h-6 text-cyan-400 mr-3" />
          <h2 className="text-xl font-bold text-white">Network Management</h2>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${isExpanded ? 'rotate-180' : ''} transition-transform`} />
        </button>
      </div>

      {/* Run Diagnostics Button */}
      <div className="mb-6">
        <button
          onClick={loadNetworkConfig}
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <Loader className="w-5 h-5 mr-2 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            <>
              🔍 Network Diagnostics
            </>
          )}
        </button>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="space-y-6 animate-fade-in">
          {/* IP Configuration Section */}
          {config && (
            <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 backdrop-blur">
              <div className="flex items-center mb-4">
                <Server className="w-5 h-5 text-blue-400 mr-2" />
                <h3 className="text-lg font-semibold text-blue-400">IP Configuration</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">Hostname</div>
                  <div className="text-white font-mono text-sm">{config.hostname}</div>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">IPv4 Address</div>
                  <div className="text-white font-mono text-sm">{config.ipv4}</div>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">IPv6 Address</div>
                  <div className="text-white font-mono text-xs truncate">{config.ipv6}</div>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">Gateway</div>
                  <div className="text-white font-mono text-sm">{config.gateway}</div>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">DNS Servers</div>
                  <div className="text-white font-mono text-sm">{config.dns}</div>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-slate-400 text-xs mb-1">MAC Address</div>
                  <div className="text-white font-mono text-sm">{config.mac}</div>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3 col-span-1 md:col-span-2">
                  <div className="text-slate-400 text-xs mb-1">DHCP</div>
                  <div className={`font-semibold ${config.dhcp ? 'text-green-400' : 'text-red-400'}`}>
                    {config.dhcp ? '✓ Enabled' : '✗ Disabled'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Results Section */}
          {diagnostics.length > 0 && (
            <div className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 backdrop-blur">
              <div className="flex items-center mb-4">
                <Wifi className="w-5 h-5 text-purple-400 mr-2" />
                <h3 className="text-lg font-semibold text-purple-400">Diagnostic Results</h3>
              </div>
              
              <div className="space-y-3">
                {diagnostics.map((test, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between bg-slate-800/50 p-4 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors"
                  >
                    <div className="flex items-center flex-1">
                      {test.status === 'success' && (
                        <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0" />
                      )}
                      {test.status === 'failed' && (
                        <XCircle className="w-6 h-6 text-red-400 mr-3 flex-shrink-0" />
                      )}
                      {test.status === 'running' && (
                        <Loader className="w-6 h-6 text-blue-400 mr-3 animate-spin flex-shrink-0" />
                      )}
                      
                      <div className="flex-1">
                        <div className="text-white font-medium mb-1">{test.name}</div>
                        <div className="text-slate-400 text-sm">{test.message}</div>
                      </div>
                    </div>
                    
                    {test.status !== 'running' && test.attempts > 0 && (
                      <div className="text-slate-500 text-sm ml-4">
                        {test.attempts} failed
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkDiagnostics;