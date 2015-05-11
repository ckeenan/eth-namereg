contract NameReg {

   event registerEvent(address indexed owner, bytes32 message, bool success);

   modifier isOwner(bytes32 name, bytes32 message) {
      address cOwner = addrByName[name];

      if (owner != tx.origin && cOwner != tx.origin) {
         registerEvent(tx.origin, message, false);
      } else {
         _
      }
   }

   modifier nameAvailable(bytes32 name, bytes32 message) {
      address cOwner = addrByName[name];

      if (cOwner != 0x0)
         registerEvent(tx.origin, message, false);
      else {
         _
      }
   }

   modifier addrAvailable(address addr, bytes32 message) {
      bytes32 name = nameByAddr[addr];

      if (name != 0x0) {
         registerEvent(tx.origin, message, false);
      } else {
         _
      }
   }

   function NameReg() {
      owner = msg.sender;
   }

   function register(address newRegisterAddr, bytes32 name, bytes d) external nameAvailable(name, "register.nameUnavailable")  {
      if (msg.value > 0)
         newRegisterAddr.send(msg.value);

      testaddr = newRegisterAddr;
      testname = name;

      data[newRegisterAddr].length = d.length;
      datalen[newRegisterAddr] = d.length;
      data[newRegisterAddr] = d;

      bytes32 oldName = nameByAddr[newRegisterAddr];

      if (oldName != 0x0)
         addrByName[oldName] = 0x0;

      nameByAddr[newRegisterAddr] = name;
      addrByName[name] = newRegisterAddr;

      registerEvent(newRegisterAddr, "register", true);
   }

   function release(bytes32 name) isOwner(name, "release.notOwner") {
      nameByAddr[tx.origin] = 0x0;
      addrByName[name] = 0x0;

      registerEvent(tx.origin, "release", true);
   }

   function transfer(bytes32 name, address newOwner) isOwner(name, "transfer.notOwner") addrAvailable(newOwner, "transfer.addrUnavailable") {
      nameByAddr[tx.origin] = 0x0;
      nameByAddr[newOwner] = name;
      addrByName[name] = newOwner;

      data[newOwner].length = data[tx.origin].length;
      data[newOwner] = data[tx.origin];
      datalen[newOwner] = datalen[tx.origin];

      registerEvent(tx.origin, "transfer", true);
   }

   function editData(uint len, bytes d) external {
      data[tx.origin].length = d.length;
      datalen[tx.origin] = d.length;
      data[tx.origin] = d;

      registerEvent(tx.origin, "editData", true);
   }

   function test(bytes32 name) external {
      testname = name;
     // testaddr = addr;
   }

   address public owner;
   address public testaddr;
   bytes32 public testname;

   mapping (address => bytes) public data;
   mapping (address => uint) public datalen;
   mapping (address => bytes32) public nameByAddr;
   mapping (bytes32 => address) public addrByName;
}
